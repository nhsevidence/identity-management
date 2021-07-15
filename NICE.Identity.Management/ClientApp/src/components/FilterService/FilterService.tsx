import React from "react";
import { Panel } from "@nice-digital/nds-panel";
//import { Radio } from "@nice-digital/nds-radio";
import { Checkbox } from "@nice-digital/nds-checkbox";
import "@nice-digital/nds-radio/scss/radio.scss";

type Services = {
	name: string;
	id: number;
};

type FilterServiceProps = {
	onCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	services: Array<Services>;
};

export const FilterService = (
	props: FilterServiceProps,
): React.ReactElement => {
	return (
		<Panel>
			<form>
				<div role="group" aria-labelledby="filter-header">
					<div id="filter-header">
						<strong>Show:</strong>
					</div>

					{
						// eslint-disable-next-line
						props.services.map((service): JSX.Element => {
							return (
								<Checkbox
									key={service.id}
									value={`${service.id}`}
									name="filter-service"
									label={service.name}
									onChange={props.onCheckboxChange}
								/>
								// <div className="radio" key={service.id}>
								// 	<input
								// 		className="radio__input"
								// 		name="filter-status"
								// 		type="radio"
								// 		id={`filter-status-${service.name}`}
								// 		value={service.id}
								// 		onChange={props.onCheckboxChange}
								// 	/>
								// 	<label
								// 		className="radio__label"
								// 		htmlFor={`filter-status-${service.name}`}
								// 	>
								// 		{service.name}
								// 	</label>
								// </div>
							);
						})
					}
				</div>
			</form>
		</Panel>
	);
};
