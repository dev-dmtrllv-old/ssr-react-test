import React from "react";
import type { Async } from "./Async";

export namespace IonAppContext
{
	export const create = (resolving: boolean = false) =>
	{
		return {
			isResolving: resolving,
			async: {
				data: {},
				resolvingComponents: {}
			}
		};
	}

	const Context = React.createContext<Type>(create());

	export const Provider = ({ ctx, children }: React.PropsWithChildren<{ ctx: Type }>) =>
	{
		return (
			<Context.Provider value={ctx}>
				{children}
			</Context.Provider>
		);
	}

	export const use = () => React.useContext(Context);

	export type Type = {
		isResolving: boolean;
		async: Async.ContextType;
	};
}
