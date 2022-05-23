import React from "react";
import { Async } from "./Async";

export namespace IonAppContext
{
	export function create(resolving: boolean = false, hydrating: boolean = false, asyncContext?: Async.ContextType): IonAppContext.Type
	{
		return {
			isResolving: resolving,
			isHydrating: hydrating,
			async: {
				data: asyncContext?.data || {},
				resolvers: {},
				resolvedDataStack: asyncContext?.resolvedDataStack || [] as any,
				popIndex: 0,
				isMounted: false,
				cache: {}
			}
		};
	}

	const Context = React.createContext<RenderType>(create(false));

	export const Provider = ({ context, children }: React.PropsWithChildren<{ context: Type }>) =>
	{
		const { isResolving, async, isHydrating } = context;
		return (
			<Context.Provider value={{ isResolving, isHydrating }}>
				<Async.Provider context={async}>
					{children}
				</Async.Provider>
			</Context.Provider>
		);
	}

	export const use = () => React.useContext(Context);

	export type RenderType = {
		isResolving: boolean;
		isHydrating: boolean;
	};

	export type Type = RenderType & {
		async: Async.ContextType;
	}
}
