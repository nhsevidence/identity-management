import { useState, useEffect } from "react";

type User = {
	id: number;
	email_address: string;
	user_id: string;
	first_name: string;
	last_name: string;
	email_verified: boolean;
	blocked: boolean;
};

export function useFetch(url: string): [Array<User>, boolean] {
	const [data, setData] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	// https://reactjs.org/docs/hooks-effect.html
	useEffect(() => {
		async function fetchUrl() {
			const response = await fetch(url);
			const json = await response.json();
			setData(json);
			setIsLoading(false);
		}

		fetchUrl(); // If you want to run an effect and clean it up only once (on mount and unmount), you can pass an empty array ([]) as a second argument
	}, [url]);

	return [data, isLoading];
}
