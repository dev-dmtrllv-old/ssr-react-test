import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Async } from "./Async";
import { Client } from "./Client";
import type { Context } from "./Context";
import { RedirectCallback, Router } from "./Router";
import { getSSRData } from "./SSRData";
import { Static } from "./Static";
import { CancelToken } from "./utils";

export class Renderer<P extends {} = {}>
{
	public static readonly isHydrating = (renderContext: RenderContext) => renderContext.renderType === "hydrating";
	public static readonly isResolving = (renderContext: RenderContext) => renderContext.renderType === "resolving";
	public static readonly isStaticRender = (renderContext: RenderContext) => renderContext.renderType === "static-render";

	private static readonly createContext = (data: Async.DataMap = {}): RenderContext => ({
		contextStacks: new Map(),
		renderType: "render",
		async: {
			data,
			resolvers: {},
			renderStack: [],
			hydrateIndex: 0
		},
		staticContext: {
			components: {}
		}
	});

	private static readonly renderContext = React.createContext<RenderContext>(this.createContext());

	public static readonly useContext = () => React.useContext(this.renderContext);

	public static readonly trackContext = <T extends any>(context: Context<T>, value: T) =>
	{
		const ctx = React.useContext(Renderer.renderContext);

		if (Renderer.isResolving(ctx))
		{
			const stack = ctx.contextStacks.get(context);
			if (!stack)
				ctx.contextStacks.set(context, [value]);
			else
				stack.push(value);
		}
	};

	public static readonly untrackContext = <T extends any>(context: Context<T>) =>
	{
		const ctx = React.useContext(Renderer.renderContext);

		if (Renderer.isResolving(ctx))
		{
			const stack = ctx.contextStacks.get(context);
			if (stack)
				stack.pop();
		}
	}

	public static readonly copyCurrentContexts = (renderContext: RenderContext): RenderContextMap =>
	{
		const map: RenderContextMap = new Map();
		renderContext.contextStacks.forEach((val, key) => map.set(key, val[val.length - 1]));
		return map;
	}

	public readonly component: React.FC<P>;
	public readonly props: P;

	public readonly context: RenderContext;

	private readonly defaultWrappedAppProps: Required<WrappedAppProps>;

	public constructor(component: React.FC<P>, props: P)
	{
		this.component = component;
		this.props = props;
		this.context = Renderer.createContext();
		this.defaultWrappedAppProps = {
			title: env.isClient ? document.title : "",
			onRedirect: async (to: string) => false,
			renderType: "render",
			component: this.component,
			props: this.props,
			contexts: new Map(),
			url: env.isClient ? window.location.pathname + window.location.search + window.location.hash : "/",
			onTitleChange: () => { }
		};
	}

	protected readonly redirectWrapped = (onRedirect: RedirectCallback) =>
	{
		const wrapped = {
			didRedirect: false,
			callback: (to: string) => 
			{
				wrapped.didRedirect = true;
				return onRedirect(to);
			},
		};
		return wrapped;
	}

	private readonly _resolveRoute = async (title: string, from: string, to: string, cancelToken: CancelToken, passedUrls: string[] = []) =>
	{
		console.log(`resolve route for ${from} -> ${to}`);
		let targetUrl = to;
		let redirectUrl = to;
		let newTitle = title;

		const onRedirect = (to) => redirectUrl = to;
		const onTitleChange = (title) => newTitle = title;

		await this.resolve({ url: targetUrl, onRedirect, onTitleChange });

		if (cancelToken.isCanceled)
			return { url: redirectUrl, title: newTitle };

		if (redirectUrl !== targetUrl) // we did a redirect!
		{
			if (passedUrls.includes(targetUrl))
			{
				console.warn(`Check redirect cycle [${passedUrls.join(' - > ')} -> ${targetUrl}]`);
				throw new Error(`Redirect cycle detected!`)
			}

			if (redirectUrl === from) // we redirected to our start point!
				return { url: redirectUrl, title };

			targetUrl = redirectUrl;

			await this.resolve({ url: targetUrl, onRedirect, onTitleChange });

			if (cancelToken.isCanceled)
				return { url: from, title };
		}

		return { url: redirectUrl, title: newTitle };
	}

	protected readonly resolveRoute = async (title: string, from: string, to: string, cancelToken: CancelToken) => this._resolveRoute(title, from, to, cancelToken);

	private readonly wrappedComponent = (wrapProps: WrappedAppProps = {}) =>
	{
		const p = { ...this.defaultWrappedAppProps, ...wrapProps };

		const { component, props, contexts, onRedirect, renderType, title, url, onTitleChange } = p;

		const WrappedProvider = ({ ctx, otherContexts, value }: { ctx: Context<any>, value: any, otherContexts: RenderContextMap }) =>
		{
			const k = otherContexts.keys()[0];

			if (k)
			{
				const contextVal = otherContexts.get(k);
				otherContexts.delete(k);
				return (
					<ctx.Provider value={value}>
						<WrappedProvider ctx={k} value={contextVal} otherContexts={otherContexts} />
					</ctx.Provider>
				);
			}
			else
			{
				return (
					<ctx.Provider value={value}>
						{React.createElement(component, props)}
					</ctx.Provider>
				);
			}
		}

		const ctxClone = new Map<any, any>(contexts);

		const k = ctxClone.keys()[0];

		if (k)
		{
			const ctxVal = ctxClone.get(k);
			ctxClone.delete(k);
			return (
				<Renderer.renderContext.Provider value={{ ...this.context, renderType }}>
					<Router title={title} url={url} onRedirect={onRedirect} resolve={this.resolveRoute} onTitleChange={onTitleChange}>
						<WrappedProvider ctx={k} value={ctxVal} otherContexts={ctxClone} />
					</Router>
				</Renderer.renderContext.Provider>
			);
		}



		return (
			<Renderer.renderContext.Provider value={{ ...this.context, renderType }}>
				<Router title={title} url={url} onRedirect={onRedirect} resolve={this.resolveRoute} onTitleChange={onTitleChange}>
					{React.createElement(component, props)}
				</Router>
			</Renderer.renderContext.Provider>
		);
	}

	protected readonly resolveStatic = (component: React.FC<any>) =>
	{
		return ReactDOMServer.renderToStaticMarkup(this.wrappedComponent({ renderType: "static-render", component }));
	}

	public readonly hydrate = async (el: HTMLElement) =>
	{
		const { api, title, async } = getSSRData();

		this.defaultWrappedAppProps.title = title;

		Async.flushRenderStack(this.context.async, async);

		Client.updateApi(api);

		const url = window.location.pathname + window.location.search + window.location.hash;

		console.group("hydrating...");
		await this.resolve({ title, url, onRedirect: () => { throw new Error("Redirected in client resolve!"); } });
		console.groupEnd();

		return ReactDOM.hydrateRoot(el, this.wrappedComponent({ title, url }));
	}

	public resolveToStaticHtml = async (component: React.FC<any>, props: any) =>
	{
		const renders = await this.resolve({ component, props });
		return Static.inject(ReactDOMServer.renderToStaticMarkup(this.wrappedComponent({ component, props, renderType: "render" })), renders);
	}

	public readonly render = async (url: string, title: string, onRedirect: RedirectCallback): Promise<RenderResult> =>
	{
		const redirect = this.redirectWrapped(onRedirect);

		let newTitle = title;

		const staticRenders = await this.resolve({ url, title, onRedirect: redirect.callback, onTitleChange: (title) => newTitle = title });

		if (redirect.didRedirect)
			return {
				didRedirect: true
			}

		return {
			didRedirect: false,
			appString: Static.inject(ReactDOMServer.renderToString(this.wrappedComponent({ url, title, onRedirect: redirect.callback })), staticRenders),
			asyncStack: this.context.async.renderStack,
			title: newTitle
		};
	}

	protected readonly resolveAsync = async (component: React.FC<any> = this.component, props: any = this.props, contexts: RenderContextMap = new Map()) =>
	{
		ReactDOMServer.renderToStaticMarkup(this.wrappedComponent({ renderType: "resolving", component, props, contexts }));

		await Async.resolveComponents(this.context.async, this.resolveAsync);

	}

	protected readonly resolve = async (wrapProps: WrappedAppProps = {}) =>
	{
		ReactDOMServer.renderToStaticMarkup(this.wrappedComponent({ renderType: "resolving", ...wrapProps }));

		// todo early exit when redirected ???

		await Async.resolveComponents(this.context.async, this.resolveAsync);

		return await Static.resolveComponents(this.context, this.resolveStatic, this.resolveToStaticHtml);
	}
}

export type RenderResult = {
	appString: string,
	asyncStack: Async.ContextType["renderStack"];
	title: string;
	didRedirect: false;
} | {
	didRedirect: true;
};

type WrappedAppProps = {
	title?: string;
	onRedirect?: RedirectCallback;
	renderType?: RenderType;
	component?: React.FC<any>;
	props?: any;
	contexts?: RenderContextMap;
	url?: string;
	onTitleChange?: (title: string) => any;
};

export type RenderContextMap = Map<Context<any>, any>;

export type RenderContext = {
	contextStacks: Map<Context<any>, any[]>;
	renderType: RenderType;
	async: Async.ContextType;
	staticContext: Static.ContextType;
};

type RenderType = "resolving" | "hydrating" | "render" | "static-render";
