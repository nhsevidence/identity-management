import React, { Component } from "react";

import { RouteComponentProps, Link, Redirect } from "react-router-dom";
import { Breadcrumbs, Breadcrumb } from "@nice-digital/nds-breadcrumbs";
import { Grid, GridItem } from "@nice-digital/nds-grid";
import { PageHeader } from "@nice-digital/nds-page-header";

import { fetchData } from "../../helpers/fetchData";
import { isDataError } from "../../helpers/isDataError";
import { UserType } from "../../models/types";
import { Endpoints } from "../../data/endpoints";
import { UnlockUser } from "../../components/UnlockUser/UnlockUser";
import { ResendVerification } from "../../components/ResendVerification/ResendVerification";
import { UserStatus } from "../../components/UserStatus/UserStatus";
import { ErrorMessage } from "../../components/ErrorMessage/ErrorMessage";
import { ToFormattedDateString } from "../../helpers/dateHelpers";

import styles from "./User.module.scss";
import { Button } from "@nice-digital/nds-button";

type TParams = { id: string };

type UserProps = {} & RouteComponentProps<TParams>;

type UserState = {
	user: UserType;
	error?: Error;
	redirect: boolean;
	isLoading: boolean;
};

export class User extends Component<UserProps, UserState> {
	constructor(props: UserProps) {
		super(props);

		this.state = {
			user: {} as UserType,
			redirect: false,
			isLoading: true,
		};
	}

	handleError = (error: Error) => {
		this.setState({ error });
	};

	updateData = (updatedData: UserType) => {
		if (!Object.keys(updatedData).length) {
			this.setState({ redirect: true });
		} else {
			this.setState({ user: updatedData });
		}
	};

	async componentDidMount() {
		this.setState({ isLoading: true });

		let user = await fetchData(Endpoints.user(this.props.match.params.id));

		if (isDataError(user)) {
			this.setState({ error: user });
		}

		this.setState({ user, isLoading: false });
		document.title = `NICE Accounts - ${user.firstName} ${user.lastName}`;
	}

	render() {
		const { user, error, redirect, isLoading } = this.state;
		const showResendVerificationButton = !user.hasVerifiedEmailAddress;

		if (redirect) {
			return <Redirect to="/users" />;
		}

		let lastBreadcrumb = `${user.firstName} ${user.lastName}`;

		if (isLoading) {
			lastBreadcrumb = "Loading user details";
		}
		if (error) {
			lastBreadcrumb = "Error";
		}

		return (
			<>
				<Breadcrumbs>
					<Breadcrumb
						data-qa-sel="breadcrumb-user-link"
						to="/users"
						elementType={Link}
					>
						Users
					</Breadcrumb>
					<Breadcrumb>{lastBreadcrumb}</Breadcrumb>
				</Breadcrumbs>

				{!error ? (
					<>
						<PageHeader
							preheading="User profile for"
							heading={
								isLoading
									? "User details"
									: `${user.firstName} ${user.lastName}`
							}
							cta={
								<>
									<Button
										data-qa-sel="add-user-role-button"
										variant="cta"
										to={`/users/${this.props.match.params.id}/services`}
										elementType={Link}
										disabled={isLoading}
									>
										{isLoading ? "Loading..." : "Add role"}
									</Button>
									<Button
										data-qa-sel="see-user-roles-button"
										variant="secondary"
										to={`/users/${user.userId}/roles`}
										elementType={Link}
										disabled={isLoading}
									>
										{isLoading ? "Loading..." : "See existing roles"}
									</Button>
								</>
							}
						/>
						<Grid>
							<GridItem cols={12} md={9} aria-busy={isLoading}>
								{isLoading ? (
									<p>Loading...</p>
								) : (
									<>
										<div className={`${styles.summaryList} pv--c`}>
											<span className={styles.summaryListLabel}>
												Account information
											</span>
											<div className={styles.summaryListDetail}>
												<div>
													<UserStatus user={user} />
												</div>
												{showResendVerificationButton && (
													<ResendVerification
														nameIdentifier={user.nameIdentifier}
														onError={this.handleError}
													/>
												)}

												<UnlockUser
													id={user.userId}
													isLocked={user.isLockedOut}
													onToggleLock={this.updateData}
													onError={this.handleError}
												/>
											</div>
										</div>

										<div className={`${styles.summaryList} pv--c mb--d`}>
											<span className={styles.summaryListLabel}>
												Email address
											</span>
											<span className={styles.summaryListDetail}>
												{user.emailAddress}
											</span>
										</div>

										<div className={`${styles.summaryList} pv--c mb--d`}>
											<span className={styles.summaryListLabel}>
												Initial registration date
											</span>
											<span className={styles.summaryListDetail}>
												{ToFormattedDateString(user.initialRegistrationDate)}
											</span>
										</div>

										<div className={`${styles.summaryList} pv--c mb--d`}>
											<span className={styles.summaryListLabel}>
												Last logged in date
											</span>
											<span className={styles.summaryListDetail}>
												{ToFormattedDateString(user.lastLoggedInDate)}
											</span>
										</div>

										<div className={`${styles.summaryList} pv--c mb--d`}>
											<span className={styles.summaryListLabel}>
												Name identifier (internal id)
											</span>
											<span className={styles.summaryListDetail}>
												{user.nameIdentifier}
											</span>
										</div>

										<div className={`${styles.summaryList} pv--c mb--d`}>
											<span className={styles.summaryListLabel}>
												Is migrated from NICE Accounts
											</span>
											<span className={styles.summaryListDetail}>
												{user.isMigrated ? "Yes" : "No"}
											</span>
										</div>

										<div className={`${styles.summaryList} pv--c mb--d`}>
											<span className={styles.summaryListLabel}>
												Is in Authentication Provider (Auth0)
											</span>
											<span className={styles.summaryListDetail}>
												{user.isInAuthenticationProvider ? "Yes" : "No"}
											</span>
										</div>

										<hr className="mv--b" />

										<h2 className="h3">Permanently delete this account</h2>
										<p>
											The account will no longer be available, and all data in
											the account will be permanently deleted.
										</p>
										<Link
											data-qa-sel="delete-user-link"
											to={`/users/${user.userId}/delete`}
										>
											Delete user
										</Link>
									</>
								)}
							</GridItem>
						</Grid>
					</>
				) : (
					<>
						<PageHeader heading="Error" />
						<ErrorMessage error={error}></ErrorMessage>
					</>
				)}
			</>
		);
	}
}
