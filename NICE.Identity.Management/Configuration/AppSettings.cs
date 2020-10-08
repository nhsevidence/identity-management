using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace NICE.Identity.Management.Configuration
{
    public static class AppSettings 
    {
        // this is a static class for storing appsettings so we don't have to use DI for passing configuration stuff
        // (i.e. to stop us having to pass IOptions<SomeConfig> through the stack)

        public static EnvironmentConfig EnvironmentConfig { get; private set; }
       
		public static void Configure(IServiceCollection services, IConfiguration configuration, string contentRootPath)
        {
            services.Configure<EnvironmentConfig>(configuration.GetSection("Environment"));
            
			var sp = services.BuildServiceProvider();
			EnvironmentConfig = sp.GetService<IOptions<EnvironmentConfig>>().Value;
		}
    }
}
