import React from "react";
import { CancelToken, object } from "./utils";
import { getClassFromProps } from "./utils/react";

const RouterContext = React.createContext<RouterContextType>({
	path: "",
	query: "",
	hash: "",
	url: "",
	routeTo: () => { },
	match: () => false,
	redirect: () => false,
	addChangeListener: () => { },
	removeChangeListener: () => { },
	useRouteChange: () => React.useEffect(() => { }, [])
});

const RouteContext = React.createContext<RouteContextType>({
	hash: "",
	params: {},
	path: "",
	query: {}
});

const useRouterContext = () => React.useContext(RouterContext);

export const useRouter = (): Readonly<RouterContextType> => React.useContext(RouterContext);

export const useRoute = () => React.useContext(RouteContext);

export const splitUrl = (url: string): RouterState =>
{
	const [path, q = ""] = url.split("?")
	const [query = "", hash = ""] = q.split("#");

	return { path, query, hash, url };
}

const resetActiveToken = (activeToken: React.MutableRefObject<CancelToken<string> | null>, url: string) => 
{
	activeToken.current && activeToken.current.cancel();
	activeToken.current = new CancelToken(url);
	return activeToken.current;
};

const cancelActiveToken = (activeToken: React.MutableRefObject<CancelToken<string> | null>) =>
{
	activeToken.current && activeToken.current.cancel();
	activeToken.current = null;
}

const getTokenUrl = (activeToken: React.RefObject<CancelToken<string>>) => activeToken.current?.data;

const addChangeListener = (listeners: React.RefObject<OnRouteChangeListener[]>) => (listener: OnRouteChangeListener) =>
{
	if (!listeners.current!.includes(listener))
		listeners.current!.push(listener);
}

const removeChangeListener = (listeners: React.RefObject<OnRouteChangeListener[]>) => (listener: OnRouteChangeListener) =>
{
	if (!listeners.current!.includes(listener))
		listeners.current!.push(listener);
}

const callListeners = async (listeners: React.MutableRefObject<OnRouteChangeListener[]>, event: ChangeEventInfo, awaitAsync: boolean) =>
{
	for (const listener of listeners.current)
	{
		if (awaitAsync)
			await listener(event);
		else
			listener(event);
	}
}

export const Router = ({ children, url, onRedirect, resolve }: React.PropsWithChildren<RouterProps>) =>
{
	const [state, setState] = React.useState<RouterState>(splitUrl(url));

	const activeToken = React.useRef<CancelToken<string> | null>(null);
	const changeListeners = React.useRef<OnRouteChangeListener[]>([]);

	// const { isResolving } = IonAppContext.use();

	const ctx: RouterContextType = {
		...state,
		routeTo: async (url) =>
		{
			if (env.isServer)
			{
				onRedirect(url);
			}
			else
			{
				if (state.url === url)
				{
					const to = activeToken.current?.data || url;
					cancelActiveToken(activeToken);

					await callListeners(changeListeners, {
						cancel: () => { },
						isCanceled: true,
						from: state.url,
						to,
						isLoading: false
					}, false);

					return;
				}
				else if (getTokenUrl(activeToken) && (url === getTokenUrl(activeToken)))
				{
					return;
				}

				const info: ChangeEventInfo = {
					cancel: () => { },
					isCanceled: false,
					from: state.url,
					to: url,
					isLoading: true
				};

				const token = resetActiveToken(activeToken, url);

				const newUrl = await resolve(state.path, url, token, async () =>
				{
					await callListeners(changeListeners, info, true);

					if (token.isCanceled)
					{
						info.isLoading = activeToken.current !== null;
						info.isCanceled = true;
						await callListeners(changeListeners, info, false);
						return;
					}
				});

				if (!token.isCanceled && (newUrl !== state.url))
				{
					info.isLoading = false;
					setState(splitUrl(newUrl));
					await callListeners(changeListeners, info, false);
				}
				else
				{
					info.isLoading = activeToken.current !== null;
					info.isCanceled = token.isCanceled;
					await callListeners(changeListeners, info, false);
				}
			}
		},
		/* TODO: if there are params in the url and not exact, allow matching shorter urls!  */
		match(url: string, exact?: boolean, params: ObjectMap<string> = {})
		{
			url = url.split("?")[0];

			const tp = state.path.split("/").filter(s => !!s);

			const p = url.split("/").filter(s => !!s);

			if (exact && (tp.length !== p.length))
				return false;
			else if ((!exact) && (tp.length < p.length))
				return false;

			for (let i = 0; i < p.length; i++)
			{
				const s = p[i];
				const ts = tp[i];
				if (s.startsWith(":"))
					params[s.substring(1, s.length)] = ts;
				else if (s !== ts)
					return false;
			}

			return true;
		},
		redirect: onRedirect,
		addChangeListener: addChangeListener(changeListeners),
		removeChangeListener: removeChangeListener(changeListeners),
		useRouteChange: (listener) =>
		{
			const { addChangeListener, removeChangeListener } = useRouterContext();

			React.useEffect(() => 
			{
				addChangeListener(listener);
				return () => removeChangeListener(listener);
			}, []);
		}
	}

	return (
		<RouterContext.Provider value={ctx}>
			{children}
		</RouterContext.Provider>
	);
}

export const Route = ({ path, exact, component, children }: React.PropsWithChildren<RouteProps>) =>
{
	const { match, ...ctx } = useRouterContext();

	let params: ObjectMap<string> = {};

	if (!match(path, exact, params))
		return null;

	if (component)
		return React.createElement(component, { children });

	const routeContext: RouteContextType = {
		path: ctx.path,
		hash: ctx.hash,
		query: object.deserialize(ctx.query),
		params,
	};

	return <RouteContext.Provider value={routeContext}>{children}</RouteContext.Provider>;
}

export const Redirect = ({ from, exact, to }: RedirectProps) =>
{
	const { match, redirect } = useRouterContext();

	if (match(from, exact))
		redirect(to);

	return null;
}

export const Link = ({ to, children, exact, text, className, activeClass = "active", onClick }: React.PropsWithChildren<LinkProps>) =>
{
	const { match, routeTo } = useRouterContext();

	const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) =>
	{
		onClick && onClick(e);
		if (!e.isDefaultPrevented() && !e.isPropagationStopped())
			routeTo(to);
	}

	const isActive = match(to, exact);

	return (
		<a className={getClassFromProps("link", { className, [activeClass]: isActive })} onClick={handleClick}>
			{text || children}
		</a>
	);
}

type RouterProps = {
	url: string;
	onRedirect: (to: string) => any;
	resolve: OnRouteResolveCallback;
};

export type OnRouteResolveCallback = (startUrl: string, url: string, cancelToken: CancelToken<string>, onResolving: () => Promise<void>) => Promise<string>;

type RouterState = {
	url: string;
	path: string;
	query: string;
	hash: string;
};

type RouteProps = {
	exact?: boolean;
	path: string;
	component?: React.FC<any>;
};

type RedirectProps = {
	exact?: boolean;
	from: string;
	to: string;
};

type LinkProps = {
	to: string;
	exact?: boolean;
	text?: string;
	activeClass?: string;
	className?: string;
	onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => any;
};

type RouterContextType = RouterState & {
	routeTo: (path: string) => any;
	match: (path: string, exact?: boolean, params?: ObjectMap<string>) => boolean;
	redirect: RedirectCallback;
	addChangeListener: (listener: OnRouteChangeListener) => void;
	removeChangeListener: (listener: OnRouteChangeListener) => void;
	useRouteChange: (listener: OnRouteChangeListener) => void;
};

export type RedirectCallback = (to: string) => boolean;

export type RouteContextType = {
	readonly path: string;
	readonly query: Readonly<ObjectMap<string>>;
	readonly hash: string;
	readonly params: Readonly<ObjectMap<string>>;
};

type OnRouteChangeListener = (event: ChangeEventInfo) => any;

type ChangeEventInfo = {
	isLoading: boolean;
	from: string;
	to: string;
	isCanceled: boolean;
	cancel: (reason?: string) => void;
};
