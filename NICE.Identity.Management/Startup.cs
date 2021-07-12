using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.SpaServices.Extensions;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NICE.Identity.Authentication.Sdk.Configuration;
using NICE.Identity.Authentication.Sdk.Extensions;
using NICE.Identity.Management.Configuration;
using ProxyKit;
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SpaServices.ReactDevelopmentServer;
using Microsoft.AspNetCore.SpaServices.Webpack;
using Microsoft.Extensions.FileProviders;
using CacheControlHeaderValue = Microsoft.Net.Http.Headers.CacheControlHeaderValue;
using IAuthenticationService = NICE.Identity.Authentication.Sdk.Authentication.IAuthenticationService;
using IConfiguration = Microsoft.Extensions.Configuration.IConfiguration;
using SameSiteMode = Microsoft.AspNetCore.Http.SameSiteMode;

namespace NICE.Identity.Management
{
	public class Startup
	{
		private const string CorsPolicyName = "CorsPolicy";

		public Startup(IConfiguration configuration, IWebHostEnvironment environment)
		{
			Configuration = configuration;
			Environment = environment;
		}

		public IConfiguration Configuration { get; }
		public IWebHostEnvironment Environment { get; }
		private const string AdministratorRole = "Administrator";
		public static string AccessKeyForLocalDevelopmentUse;

		// This method gets called by the runtime. Use this method to add services to the container.
		public void ConfigureServices(IServiceCollection services)
		{
			AppSettings.Configure(services, Configuration, Environment.IsDevelopment() ? @"c:\" : Environment.ContentRootPath);

			//dependency injection goes here.
			services.AddHttpContextAccessor();
			services.AddTransient<HealthCheckDelegatingHandler>();

			// TODO: remove httpClientBuilder
			// This bypasses any certificate validation on proxy requests
			// Only done due to local APIs not having certificates configured 
			services.AddProxy(httpClientBuilder => httpClientBuilder.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                    ClientCertificateOptions = ClientCertificateOption.Manual,
                    ServerCertificateCustomValidationCallback = (httpRequestMessage, cert, cetChain, policyErrors) => true
            }));
            services.Configure<CookiePolicyOptions>(options =>
			{
				// This lambda determines whether user consent for non-essential cookies is needed for a given request.
				options.CheckConsentNeeded = context => true;
				options.MinimumSameSitePolicy = SameSiteMode.None;
			});

            services.AddRouting(options => options.LowercaseUrls = true);

            services.AddControllersWithViews(); //(options => options.EnableEndpointRouting = true);

            // Add authentication services
            var authConfiguration = new AuthConfiguration(Configuration, "WebAppConfiguration");
            services.AddAuthentication(authConfiguration, allowNonSecureCookie: Environment.IsDevelopment());
            services.AddAuthorisation(authConfiguration);

            // In production, the React files will be served from this directory
			services.AddSpaStaticFiles(configuration =>
			{
				configuration.RootPath = "ClientApp/build";
			});

			services.AddHealthChecks();
			services.AddHealthChecksUI(setupSettings: setup =>
				{
					setup.UseApiEndpointDelegatingHandler<HealthCheckDelegatingHandler>();
				})
				.AddInMemoryStorage();

			services.AddCors(options =>
			{
				options.AddPolicy(CorsPolicyName,
					builder => builder.WithOrigins(AppSettings.EnvironmentConfig.CorsOrigin, "http://localhost:3000")
						.AllowAnyMethod()
						.AllowAnyHeader()
						.AllowCredentials());
			});

			services.AddOptions();
		}

		// This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
		[Obsolete] //obselete added as proxykit marked the runproxy as deprecated. we should switch to https://github.com/microsoft/reverse-proxy when it's released though. - currently it's just a release candidate.
		public void Configure(IApplicationBuilder app, IWebHostEnvironment env, ILoggerFactory loggerFactory, ILogger<Startup> startupLogger,
			IHostApplicationLifetime appLifetime, IAuthenticationService niceAuthenticationService, IHttpContextAccessor httpContextAccessor)
		{
			startupLogger.LogInformation("Identity management is starting up");

            app.Use(async (context, next) =>
                {
                    context.Response.OnStarting(() =>
                    {
                        context.Response.Headers.Add("Permissions-Policy", "interest-cohort=()");
                        return Task.FromResult(0);
                    });
                    await next();
                }
            );

			if (env.IsDevelopment())
			{
				app.UseDeveloperExceptionPage();
			}
			else
			{
				app.UseExceptionHandler("/Home/Error");
				app.UseHsts();
				app.UseStatusCodePagesWithReExecute("/error/{0}"); // url to errorcontroller
			}

			app.UseCors(CorsPolicyName);

			app.RunProxy("/api",async context =>
            {
	           // System.Diagnostics.Debugger.Launch();
                var apiEndpoint = Configuration.GetSection("WebAppConfiguration")["AuthorisationServiceUri"];
                apiEndpoint += apiEndpoint.EndsWith("/") ? "api" : "/api";
                startupLogger.LogDebug($"Proxy to endpoint {apiEndpoint}");
                var forwardContext = context
                    .ForwardTo(apiEndpoint)
                    .CopyXForwardedHeaders()
                    .AddXForwardedHeaders();
                // TODO: Add token expiration handling
                startupLogger.LogDebug("Proxy call started");
                if (!forwardContext.UpstreamRequest.Headers.Contains("Authorization"))
                {
                    startupLogger.LogDebug("Proxy Add Authorization");
                    var accessToken = await httpContextAccessor.HttpContext.GetTokenAsync("access_token");

#if DEBUG
	                if (env.IsDevelopment())
                    {
	                    AccessKeyForLocalDevelopmentUse ??= accessToken; //this is a hack to enable the front-end to share the access token with the backend. local dev only. it'd be a major security flaw elsewhere.
	                    accessToken ??= AccessKeyForLocalDevelopmentUse;
                    }
#endif

					forwardContext.UpstreamRequest.Headers.Authorization = 
                        new AuthenticationHeaderValue("Bearer", accessToken);
                    startupLogger.LogDebug($"Proxy Authorization: {forwardContext.UpstreamRequest.Headers.Authorization}");
                }

                try
                {
                    startupLogger.LogDebug("Proxy send started");
                    var response = await forwardContext.Send();
                    if (!response.IsSuccessStatusCode)
                    {
                        var errorMessage = $"Proxy error: {response.StatusCode.ToString()}:{response.ReasonPhrase} - " +
                                           $"{await response.Content.ReadAsStringAsync()}"; 
                        startupLogger.LogError(errorMessage);
                    }
                    response.Headers.Remove("Authorization");
                    startupLogger.LogDebug($"Proxy response: {await response.Content.ReadAsStringAsync()}");
                    return response;
                }
                catch (Exception e)
                {
                    startupLogger.LogError(e.Message);
                    return new HttpResponseMessage()
                    {
                        StatusCode = HttpStatusCode.InternalServerError,
                        ReasonPhrase = e.Message
                    };
                }
            });

			app.UseHttpsRedirection();
			//app.UseCookiePolicy();

			

			app.UseAuthentication();
			app.UseAuthorization(); 

			app.UseStaticFiles();


			app.UseSpaStaticFiles(new StaticFileOptions()
			{
				OnPrepareResponse = context =>
				{
					if (context.Context.Request.Path.StartsWithSegments("/static"))
					{
						// cache static resources for one year (versioned filenames)
						var headers = context.Context.Response.GetTypedHeaders();
						headers.CacheControl = new CacheControlHeaderValue
						{
							Public = true,
							MaxAge = TimeSpan.FromDays(365)
						};
					}
					else
					{
						// do not cache other files. also see UseSpa
						var headers = context.Context.Response.GetTypedHeaders();
						headers.CacheControl = new CacheControlHeaderValue
						{
							Public = true,
							NoCache = true,
							NoStore = true,
							MustRevalidate = true,
							MaxAge = TimeSpan.FromDays(0),
						};
					}
				}
			});


			

			app.Use((context, next) =>
			{
				if (context.Request.Headers["X-Forwarded-Proto"] == "https" ||
				    context.Request.Headers["Front-End-Https"] == "on" ||
					context.Request.Headers.ContainsKey("X-ARR-SSL"))
				{
					context.Request.Scheme = "https";
				}
				return next();
			});

			app.UseRouting();

			app.UseEndpoints(endpoints =>
			{
				endpoints.MapDefaultControllerRoute();
				endpoints.MapHealthChecks(AppSettings.EnvironmentConfig.HealthCheckPublicAPIEndpoint, new HealthCheckOptions()
				{
					Predicate = _ => true,
					ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
				});
				endpoints.MapHealthChecksUI(setup =>
				{
					setup.AddCustomStylesheet("wwwroot/NICE.Style.css");
				}).RequireAuthorization(new AuthorizeAttribute(AdministratorRole));
			});

			app.MapWhen(httpContext => !httpContext.User.Identity.IsAuthenticated, builder =>
			{
				builder.Run(async context =>
				{
					await niceAuthenticationService.Login(context, context.Request.Path);
				});
			});

			app.MapWhen(httpContext => httpContext.User.Identity.IsAuthenticated && !httpContext.User.IsInRole(AdministratorRole), builder =>
			{
				builder.Run(async httpContext =>
				{
					startupLogger.LogWarning($"User: {httpContext.User.DisplayName()} with id: {httpContext.User.NameIdentifier()} has tried accessing {httpContext.Request.Host.Value}{httpContext.Request.Path} but does not have access");
					httpContext.Response.StatusCode = (int)HttpStatusCode.Forbidden;
					await httpContext.Response.WriteAsync("You do not have access to this website. Please contact support if you think this is incorrect.");
				});
			});

			app.MapWhen(httpContext => httpContext.User.Identity.IsAuthenticated && httpContext.User.IsInRole(AdministratorRole), builder =>
			{
				// DotNetCore SpaServices requires RawTarget property, which isn't set on a TestServer.
				// So set it here to allow integration tests to work with SSR via SpaServices
				builder.Use((httpContext, next) =>
				{
					var httpRequestFeature = httpContext.Features.Get<IHttpRequestFeature>();

					if (httpRequestFeature != null && string.IsNullOrEmpty(httpRequestFeature.RawTarget))
						httpRequestFeature.RawTarget = httpRequestFeature.Path;
					return next();
				});

				builder.UseSpa(spa =>
				{
					spa.Options.SourcePath = "ClientApp";

					spa.Options.DefaultPageStaticFileOptions = new StaticFileOptions()
					{
						OnPrepareResponse = ctx =>
						{
							// do not cache files. also see UseSpaStaticFiles
							var headers = ctx.Context.Response.GetTypedHeaders();
							headers.CacheControl = new CacheControlHeaderValue
							{
								Public = true,
								NoCache = true,
								NoStore = true,
								MustRevalidate = true,
								MaxAge = TimeSpan.FromDays(0)
							};
						}
					};

					//if (env.IsDevelopment())
					//{
					//	//spa.UseReactDevelopmentServer(npmScript: "start");
					//	spa.UseProxyToSpaDevelopmentServer("http://localhost:3000");
					//}
				});
			});
		}

    }
}
