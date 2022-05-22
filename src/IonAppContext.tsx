import React from "react";
import { Async } from "./Async";

export namespace IonAppContext
{
	export function create(isServer: boolean, resolving?: false, hydrating?: true, asyncData?: Async.ContextType["resolvedDataStack"]): IonAppContext.Type;
	export function create(isServer: boolean, resolving?: true, hydrating?: false, asyncData?: Async.ContextType["data"]): IonAppContext.Type;
	export function create(isServer: boolean, resolving?: false, hydrating?: false): IonAppContext.Type;
	export function create(isServer: boolean, resolving: boolean = false, hydrating: boolean = false, asyncData: Async.ContextType["data"] | Async.ContextType["resolvedDataStack"] | undefined = undefined): IonAppContext.Type
	{
		const data = hydrating ? {} : asyncData;
		const resolvedDataStack = hydrating ? asyncData : [];

		return {
			isResolving: resolving,
			isClient: !isServer,
			isHydrating: hydrating,
			isServer,
			async: {
				data: data || {},
				resolvers: {},
				resolvedDataStack: resolvedDataStack || [] as any
			}
		};
	}

	const Context = React.createContext<RenderType>(create(false));

	export const Provider = ({ context, children }: React.PropsWithChildren<{ context: Type }>) =>
	{
		const { isResolving, async, isClient, isServer, isHydrating } = context;
		return (
			<Context.Provider value={{ isResolving, isClient, isServer, isHydrating }}>
				<Async.Provider context={async}>
					{children}
				</Async.Provider>
			</Context.Provider>
		);
	}

	export const use = () => React.useContext(Context);

	export type RenderType = {
		isResolving: boolean;
		isClient: boolean;
		isServer: boolean;
		isHydrating: boolean;
	};

	export type Type = RenderType & {
		async: Async.ContextType;
	}
}
