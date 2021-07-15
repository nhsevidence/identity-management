import React, { Component } from "react";

import { Link } from "react-router-dom";
import { Breadcrumbs, Breadcrumb } from "@nice-digital/nds-breadcrumbs";
import { Card } from "@nice-digital/nds-card";
import { Grid, GridItem } from "@nice-digital/nds-grid";
import { PageHeader } from "@nice-digital/nds-page-header";
import {
	queryStringToObject,
	appendQueryParameter,
	removeQueryParameter,
	stripMultipleQueries,
} from "../../utils/querystring";

import { fetchData } from "../../helpers/fetchData";
import { isDataError } from "../../helpers/isDataError";
import { Endpoints } from "../../data/endpoints";
import { UserType, HistoryType } from "../../models/types";
import { FilterSearch } from "../../components/FilterSearch/FilterSearch";
import { FilterStatus } from "../../components/FilterStatus/FilterStatus";
import { FilterService } from "../../components/FilterService/FilterService";
import { UserStatus } from "../../components/UserStatus/UserStatus";
import { ErrorMessage } from "../../components/ErrorMessage/ErrorMessage";
import { Pagination } from "../../components/Pagination/Pagination";

import styles from "./UsersList.module.scss";

type CardMetaData = {
	label?: string;
	value: React.ReactNode;
};

type statusFilterOptions = {
	[key: string]: (user: UserType) => boolean;
};

type UsersListProps = {
	basename: string;
	location: {
		pathname: string;
		search: string;
	};
	history: HistoryType;
};

type UsersListState = {
	path: string;
	originalUsers: Array<UserType>;
	users: Array<UserType>;
	searchQuery?: string;
	error?: Error;
	isLoading: boolean;
	statusFilter?: string;
	serviceFilter: Array<number>;
	pageNumber: number;
	itemsPerPage: number | string;
};

export class UsersList extends Component<UsersListProps, UsersListState> {
	constructor(props: UsersListProps) {
		super(props);

		const querystring = this.props.location.search;

		const querystringObject = queryStringToObject(querystring);

		const pageNumber = Number(
			querystringObject.page
				? Array.isArray(querystringObject.page)
					? querystringObject.page[0]
					: querystringObject.page
				: 1,
		);

		let itemsPerPage = querystringObject.amount
			? Array.isArray(querystringObject.amount)
				? querystringObject.amount[0]
				: querystringObject.amount
			: 25;

		itemsPerPage = Number(itemsPerPage) ? Number(itemsPerPage) : itemsPerPage;

		this.state = {
			path: "",
			originalUsers: [],
			users: [],
			isLoading: true,
			serviceFilter: [],
			pageNumber: pageNumber,
			itemsPerPage: itemsPerPage,
		};

		document.title = "NICE Accounts - Users list";
	}

	async componentDidMount(): Promise<void> {
		this.setState({ isLoading: true });

		const users = await fetchData(Endpoints.usersList);

		if (isDataError(users)) {
			this.setState({ error: users });
		}

		this.setState({ originalUsers: users, users, isLoading: false });
	}

	pastPageRange = (
		itemsPerPage: string | number,
		pageNumber: number,
		dataCount: number,
	): number => {
		let pastPageRange = false;

		if (Number(itemsPerPage)) {
			itemsPerPage = Number(itemsPerPage);
			pastPageRange = pageNumber * itemsPerPage >= dataCount;
		}

		if (pastPageRange || itemsPerPage === "all") {
			pageNumber = 1;
		}

		return pageNumber;
	};

	filterUsersByStatus = (e: React.ChangeEvent<HTMLInputElement>): void => {
		this.setState({ isLoading: true });

		const statusFilter = e.target.value;

		let users = this.state.originalUsers,
			pageNumber = this.state.pageNumber;

		const itemsPerPage = Number(this.state.itemsPerPage)
			? Number(this.state.itemsPerPage)
			: this.state.itemsPerPage;

		if (statusFilter) {
			users = this.usersByStatus(statusFilter, users);
		}

		pageNumber = this.pastPageRange(
			itemsPerPage,
			pageNumber,
			this.state.users.length,
		);

		this.setState({ users, statusFilter, pageNumber, isLoading: false });
	};

	filterUsersByService = (e: React.ChangeEvent<HTMLInputElement>) => {
		this.setState({ isLoading: true });

		const serviceId = parseInt(e.target.value);

		let serviceFilter = this.state.serviceFilter;

		serviceFilter = serviceFilter.includes(serviceId)
			? serviceFilter.filter((value) => value !== serviceId)
			: serviceFilter.concat(serviceId);

		const itemsPerPage = Number(this.state.itemsPerPage)
			? Number(this.state.itemsPerPage)
			: this.state.itemsPerPage;

		let users = this.state.originalUsers;
		let pageNumber = this.state.pageNumber;

		if (serviceFilter.length) {
			users = this.usersByService(serviceFilter, users);
		}

		pageNumber = this.pastPageRange(
			itemsPerPage,
			pageNumber,
			this.state.users.length,
		);

		this.setState({ users, serviceFilter, pageNumber, isLoading: false });
	};

	filterUsersBySearch = async (searchQuery: string): Promise<void> => {
		this.setState({ isLoading: true });

		const originalUsers = await fetchData(
			`${Endpoints.usersList}?q=${searchQuery}`,
		);

		let users = originalUsers,
			pageNumber = this.state.pageNumber;

		const itemsPerPage = Number(this.state.itemsPerPage)
			? Number(this.state.itemsPerPage)
			: this.state.itemsPerPage;

		if (isDataError(originalUsers)) {
			this.setState({ error: originalUsers });
		}

		if (this.state.statusFilter) {
			users = this.usersByStatus(this.state.statusFilter, users);
		}

		if (this.state.serviceFilter) {
			users = this.usersByService(this.state.serviceFilter, users);
		}

		pageNumber = this.pastPageRange(
			itemsPerPage,
			pageNumber,
			this.state.users.length,
		);

		this.setState({
			originalUsers,
			users,
			searchQuery,
			pageNumber,
			isLoading: false,
		});
	};

	usersByService = (
		serviceFilter: Array<number>,
		users: Array<UserType>,
	): Array<UserType> => {
		return (users = users.filter((user) => {
			let userServices = user.hasAccessToServiceIds;

			if (userServices.some((r) => serviceFilter.indexOf(r) >= 0)) {
				return user;
			}
		}));
	};

	usersByStatus = (
		statusFilter: string,
		users: Array<UserType>,
	): Array<UserType> => {
		const statusFilterOptions: statusFilterOptions = {
			active: (user) => !user.isLockedOut && user.hasVerifiedEmailAddress,
			pending: (user) => !user.hasVerifiedEmailAddress,
			locked: (user) => user.isLockedOut,
		};

		const filteredUsers = users.filter(statusFilterOptions[statusFilter]);

		return filteredUsers;
	};

	getPaginateStartAndFinishPosition = (
		consultationsCount: number,
		pageNumber: number,
		itemsPerPage: number | string,
	): { start: number; finish: number } => {
		const paginationPositions = {
			start: 0,
			finish: consultationsCount,
		};

		const itemAmountIsNumber = Number(itemsPerPage);

		if (itemAmountIsNumber) {
			paginationPositions.start = (pageNumber - 1) * itemAmountIsNumber;
			paginationPositions.finish =
				paginationPositions.start + itemAmountIsNumber <= consultationsCount
					? paginationPositions.start + itemAmountIsNumber
					: consultationsCount;
		}

		return paginationPositions;
	};

	getPaginationText = (
		usersCount: number,
		start: number,
		finish: number,
	): string => {
		const amountPerPage = finish - start;
		const paginationExtract =
			usersCount > amountPerPage ? `${start + 1} to ${finish} of ` : "";

		return `Showing ${paginationExtract}${usersCount} user${
			usersCount === 1 ? "" : "s"
		}`;
	};

	changeAmount = (e: React.ChangeEvent<HTMLSelectElement>): void => {
		let itemsPerPage = (e.target as HTMLSelectElement).value || 25,
			pageNumber = this.state.pageNumber,
			path = stripMultipleQueries(this.state.path, ["amount", "page"]);

		itemsPerPage = Number(itemsPerPage) ? Number(itemsPerPage) : itemsPerPage;

		pageNumber = this.pastPageRange(
			itemsPerPage,
			pageNumber,
			this.state.users.length,
		);

		path = appendQueryParameter(path, "amount", itemsPerPage.toString());
		path = appendQueryParameter(path, "page", pageNumber);

		this.setState({ itemsPerPage, path, pageNumber }, () => {
			this.props.history.push(path);
		});
	};

	changePage = (e: React.MouseEvent<HTMLAnchorElement>): void => {
		e.preventDefault();

		let pageNumber =
				(e.target as HTMLAnchorElement).getAttribute("data-pager") || 1,
			path = removeQueryParameter(this.state.path, "page");

		if (pageNumber === "previous") {
			pageNumber = this.state.pageNumber - 1;
		}
		if (pageNumber === "next") {
			pageNumber = this.state.pageNumber + 1;
		}

		pageNumber = Number(pageNumber);
		path = appendQueryParameter(path, "page", pageNumber);

		this.setState({ pageNumber, path }, () => {
			this.props.history.push(path);
		});
	};

	render(): JSX.Element {
		const { users, searchQuery, error, isLoading, pageNumber, itemsPerPage } =
			this.state;

		const paginationPositions = this.getPaginateStartAndFinishPosition(
			users.length,
			pageNumber,
			itemsPerPage,
		);

		const paginationText = this.getPaginationText(
			users.length,
			paginationPositions.start,
			paginationPositions.finish,
		);

		const usersPaginated = users.length
			? users.slice(paginationPositions.start, paginationPositions.finish)
			: users;

		const dummyServices = [
			{
				name: "dev-eppi.nice.org.uk",
				id: 1,
			},
			{
				name: "test-eppi.nice.org.uk",
				id: 2,
			},
			{
				name: "dev-comments.nice.org.uk",
				id: 3,
			},
			{
				name: "alpha-comments.nice.org.uk",
				id: 4,
			},
			{
				name: "idam",
				id: 5,
			},
		];

		return (
			<>
				<Breadcrumbs>
					<Breadcrumb to="/overview" elementType={Link}>
						Administration
					</Breadcrumb>
					<Breadcrumb>Users</Breadcrumb>
				</Breadcrumbs>

				<PageHeader heading="Users" />

				{!error ? (
					<Grid>
						<GridItem cols={12} md={3}>
							<FilterSearch onInputChange={this.filterUsersBySearch} />
							<FilterStatus onCheckboxChange={this.filterUsersByStatus} />
							<FilterService
								onCheckboxChange={this.filterUsersByService}
								services={dummyServices}
							/>
						</GridItem>
						<GridItem cols={12} md={9} aria-busy={!users.length}>
							{isLoading ? (
								<p>Loading...</p>
							) : users.length ? (
								<>
									<h2 className={styles.usersListSummary}>{paginationText}</h2>
									<ul className="list--unstyled" data-qa-sel="list-of-users">
										{usersPaginated.map((user) => {
											const {
												userId,
												emailAddress,
												nameIdentifier,
												firstName,
												lastName,
											} = user;
											const usersListHeading = {
												headingText: `${firstName} ${lastName}`,
												link: {
													elementType: Link,
													destination: `/users/${userId}`,
												},
											};

											const usersListMetadata: Array<CardMetaData> = [
												{
													value: <UserStatus user={user} />,
												},
												{
													label: "Email address",
													value: emailAddress,
												},
											];

											return (
												<li key={nameIdentifier}>
													<Card
														{...usersListHeading}
														metadata={usersListMetadata}
														key={nameIdentifier}
													/>
												</li>
											);
										})}
									</ul>
									<Pagination
										onChangePage={this.changePage}
										onChangeAmount={this.changeAmount}
										itemsPerPage={itemsPerPage}
										consultationCount={users.length}
										currentPage={pageNumber}
									/>
								</>
							) : searchQuery ? (
								<p>No results found for {searchQuery}</p>
							) : (
								<p>No results found</p>
							)}
						</GridItem>
					</Grid>
				) : (
					<ErrorMessage error={error}></ErrorMessage>
				)}
			</>
		);
	}
}
