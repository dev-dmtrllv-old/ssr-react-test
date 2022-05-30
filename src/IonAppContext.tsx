import React from "react";
import { Async } from "./Async";
import type { IonApp } from "./IonApp";
import { OnRouteResolveCallback, Router } from "./Router";
import { Static } from "./Static";

export namespace IonAppContext
{
	export function create(fetcher: IonApp.Fetcher, resolving: boolean = false, hydrating: boolean = false, asyncContext?: Async.ContextType): IonAppContext.Type
	{
		return {
			isResolving: resolving,
			isHydrating: hydrating,
			async: {
				fetcher,
				data: asyncContext?.data || {},
				resolvers: {},
				resolvedDataStack: asyncContext?.resolvedDataStack || [] as any,
				popIndex: 0,
				isMounted: false,
				cache: {},
				abortControllers: {}
			},
			staticContext: {
				components: {}
			}
		};
	}

	const Context = React.createContext<RenderType>(create(async () => { return { error: new Error(`No valid IonAppContext provided!`) } }, false));

	export const Provider = ({ context, onRedirect, onResolveRoute, url, children, title = "" }: React.PropsWithChildren<AppContextProps>) =>
	{
		const { isResolving, async, isHydrating, staticContext } = context;
		return (
			<Context.Provider value={{ isResolving, isHydrating }}>
				<Static.Provider context={staticContext}>
					<Async.Provider context={async}>
						<Router onRedirect={onRedirect} resolve={onResolveRoute} url={url} title={title}>
							{children}
						</Router>
					</Async.Provider>
				</Static.Provider>
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
		staticContext: Static.ContextType;
	}

	type AppContextProps = {
		url: string;
		context: Type;
		title?: string;
		onRedirect: (to: string) => any;
		onResolveRoute: OnRouteResolveCallback;
		onTitleChange: (title: string) => any;
	}
}
