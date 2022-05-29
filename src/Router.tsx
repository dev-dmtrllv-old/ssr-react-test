import React from "react";
import { IonAppContext } from "./IonAppContext";
import { CancelToken, object } from "./utils";
import { getClassFromProps } from "./utils/react";

const RouterContext = React.createContext<RouterContextType>({
	path: "",
	query: "",
	hash: "",
	url: "",
	title: "",
	routeTo: () => { },
	match: () => false,
	redirect: () => false,
	addChangeListener: () => { },
	removeChangeListener: () => { },
	useRouteChange: (listener) => useRouteChange(listener),
	setTitle: (title) => title
});

const RouteContext = React.createContext<RouteContextType>({
	hash: "",
	params: {},
	path: "",
	query: {},
	setTitle: (t) => t
});

export const useRouter = (): Readonly<RouterContextType> => React.useContext(RouterContext);

export const useRoute = () => React.useContext(RouteContext);

export const useRouteParams = <ParamKeys extends string>(): KeyedMap<ParamKeys, string> => useRoute().params as KeyedMap<ParamKeys, string>;
export const useRouteQuery = <QueryKeys extends string>(): KeyedMap<QueryKeys, string> => useRoute().query as KeyedMap<QueryKeys, string>;

export const splitUrl = (url: string): UrlState =>
{
	const [path, q = ""] = url.split("?")
	const [query = "", hash = ""] = q.split("#");

	return { path, query, hash, url };
}

export const useRouteChange = (routeChangeListener: OnRouteChangeListener) =>
{
	const { addChangeListener, removeChangeListener } = useRouter();

	React.useEffect(() => 
	{
		addChangeListener(routeChangeListener);
		return () => 
		{
			removeChangeListener(routeChangeListener);
		};
	}, []);
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


export const Router = ({ children, url, onRedirect, resolve, title, onTitleChange = () => { } }: React.PropsWithChildren<RouterProps>) =>
{
	const [state, setState] = React.useState<RouterState>(() => ({ ...splitUrl(url), title }));

	const activeToken = React.useRef<CancelToken<string> | null>(null);
	const changeListeners = React.useRef<OnRouteChangeListener[]>([]);

	const setStateRef = React.useRef(setState);

	const { isResolving, isHydrating } = IonAppContext.use();

	const routeToHandler = async (url, fromHistory = false) =>
	{
		if (env.isServer)
		{
			onRedirect(url);
			return false;
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
				if (!fromHistory)
				{
					window.history.pushState(null, "", state.url);
					window.history.replaceState(null, "", newUrl);
				}
				setState({ ...splitUrl(newUrl), title: state.title });
				await callListeners(changeListeners, info, false);
				return true;
			}
			else
			{
				info.isLoading = activeToken.current !== null;
				info.isCanceled = token.isCanceled;
				await callListeners(changeListeners, info, false);
			}
		}
	}

	const onPopState = async (e: PopStateEvent) =>
	{
		e.preventDefault();
		e.stopPropagation();

		await routeToHandler(window.location.pathname + window.location.search + window.location.hash, true);
	}

	const ctx: RouterContextType = {
		...state,
		routeTo: routeToHandler,
		/* TODO: if there are params in the url and not exact, allow matching shorter urls!  */
		match(url: string, exact?: boolean, params: ObjectMap<string> = {})
		{
			url = url.split("?")[0];

			const tp = state.path.split("/").filter(s => !!s);

			const p = url.split("/").filter(s => !!s);

			if (exact && (tp.length !== p.length))
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
		useRouteChange,
		setTitle: (...titleParts: string[]) =>
		{
			
			const t = [...titleParts, title].filter(s => !!s).join(" - ");
			onTitleChange(t);
			if (!isResolving && !isHydrating && env.isClient)
			{
				document.title = t;
				console.log("update state", t);
				setStateRef.current({ ...state, title: t });
			}
			return t;
		}
	};

	React.useEffect(() => 
	{
		setStateRef.current = setState;
		window.addEventListener("popstate", onPopState);
		return () =>
		{
			window.removeEventListener("popstate", onPopState);
		}
	}, []);

	return (
		<RouterContext.Provider value={ctx}>
			{children}
		</RouterContext.Provider>
	);
}

export const Route = ({ path, exact, component, children, title }: React.PropsWithChildren<RouteProps>) =>
{
	const { match, ...ctx } = useRouter();

	let params: ObjectMap<string> = {};

	const routeContext: RouteContextType = {
		path: ctx.path,
		hash: ctx.hash,
		query: object.deserialize(ctx.query),
		params,
		setTitle: ctx.setTitle
	};

	const setTitle = () =>
	{
		if (match(path, exact, params) && title)
		{
			const toArr = (a: string | string[]) => Array.isArray(a) ? a : [a];
			const titleParts = typeof title === "function" ? toArr(title(params)) : toArr(title);
			ctx.setTitle(...titleParts);
		}
	}

	if (env.isServer)
		setTitle();

	React.useEffect(() => setTitle(), [ctx.url]);

	if (!match(path, exact, params))
		return null;

	return <RouteContext.Provider value={routeContext}>{component ? React.createElement(component, { children }) : children}</RouteContext.Provider>;
}

export const Redirect = ({ from, exact, to }: RedirectProps) =>
{
	const { match, redirect } = useRouter();

	if (match(from, exact))
		redirect(to);

	return null;
}

export const Link = ({ to, children, exact, text, className, activeClass = "active", onClick }: React.PropsWithChildren<LinkProps>) =>
{
	const { match, routeTo } = useRouter();

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
	title: string;
	url: string;
	onRedirect: (to: string) => any;
	onTitleChange?: (title: string) => any;
	resolve: OnRouteResolveCallback;
};

export type OnRouteResolveCallback = (startUrl: string, url: string, cancelToken: CancelToken<string>, onResolving: () => Promise<void>) => Promise<string>;

type RouterState = UrlState & {
	title: string;
};

type UrlState = {
	url: string;
	path: string;
	query: string;
	hash: string;
};

type RouteProps = {
	exact?: boolean;
	path: string;
	component?: React.FC<any>;
	title?: string | string[] | ((params: ObjectMap<string>) => string | string[]);
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
	setTitle: (...titleParts: string[]) => string;
};

export type RedirectCallback = (to: string) => boolean;

export type RouteContextType = {
	readonly path: string;
	readonly query: Readonly<ObjectMap<string>>;
	readonly hash: string;
	readonly params: Readonly<ObjectMap<string>>;
	readonly setTitle: (...titleParts: string[]) => string;
};

type OnRouteChangeListener = (event: ChangeEventInfo) => any;

type ChangeEventInfo = {
	isLoading: boolean;
	from: string;
	to: string;
	isCanceled: boolean;
	cancel: (reason?: string) => void;
};
