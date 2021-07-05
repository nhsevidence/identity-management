/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import React, { Component } from "react";
import { RouteComponentProps, Link } from "react-router-dom";

import { Breadcrumbs, Breadcrumb } from "@nice-digital/nds-breadcrumbs";
import { Grid, GridItem } from "@nice-digital/nds-grid";
import { PageHeader } from "@nice-digital/nds-page-header";

import { ErrorMessage } from "../../components/ErrorMessage/ErrorMessage";

import { fetchData } from "../../helpers/fetchData";
import { isDataError } from "../../helpers/isDataError";
import { Endpoints } from "../../data/endpoints";
import { UserWithRolesType } from "../../models/types";

import styles from "../User/User.module.scss";

type TParams = { id: string };

type ExistingRolesProps = {} & RouteComponentProps<TParams>;

type ExistingRolesState = {
	userWithRoles: UserWithRolesType;
	existingRoles: Array<any>;
	isLoading: boolean;
	error?: Error;
};

type RolesPerSite = {
	id: number;
	role: Role;
};

type Role = {
	name: string;
};

export class ExistingRoles extends Component<
	ExistingRolesProps,
	ExistingRolesState
> {
	constructor(props: ExistingRolesProps) {
		super(props);

		this.state = {
			userWithRoles: {} as UserWithRolesType,
			existingRoles: [],
			isLoading: true,
		};
	}

	async componentDidMount() {
		this.setState({ isLoading: true });

		const userWithRoles = await fetchData(
			Endpoints.userWithRoles(this.props.match.params.id),
		);

		console.log(userWithRoles);

		if (isDataError(userWithRoles)) {
			this.setState({ error: userWithRoles });
		}

		const existingRoles = userWithRoles.userRoles.reduce(
			(result: any, role: any) => {
				result[role.role.website.service.name] =
					result[role.role.website.service.name] || [];
				result[role.role.website.service.name].push(role);
				return result;
			},
			Object.create(null),
		);

		this.setState({ userWithRoles, existingRoles, isLoading: false });
	}

	render() {
		const { userWithRoles, existingRoles, isLoading, error } = this.state;

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
					<Breadcrumb
						to={`/users/${this.props.match.params.id}`}
						elementType={Link}
					>
						{`${userWithRoles.firstName} ${userWithRoles.lastName}`}
					</Breadcrumb>
					<Breadcrumb>Existing roles</Breadcrumb>
				</Breadcrumbs>

				{!error ? (
					<>
						<PageHeader
							preheading="Existing roles for"
							heading={
								isLoading
									? "Existing roles"
									: `${userWithRoles.firstName} ${userWithRoles.lastName}`
							}
						/>
						<Grid>
							<GridItem cols={12} md={9} aria-busy={isLoading}>
								{isLoading ? (
									<p>Loading...</p>
								) : (
									Object.keys(existingRoles).length && (
										<>
											{Object.entries(existingRoles).map(([key, value]) => (
												<div
													className={`${styles.summaryListTopAlign} pv--c mb--d`}
												>
													<span className={styles.summaryListLabel}>{key}</span>
													<div className={styles.summaryListTable}>
														{value.map(
															(role: RolesPerSite): React.ReactElement => {
																return (
																	<>
																		<span key={role.id}>{role.role.name}</span>
																		<br />
																	</>
																);
															},
														)}
													</div>
												</div>
											))}
										</>
									)
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
