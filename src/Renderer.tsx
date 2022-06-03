import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Async } from "./Async";
import type { Context } from "./Context";
import { Static } from "./Static";

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

	public constructor(component: React.FC<P>, props: P)
	{
		this.component = component;
		this.props = props;
		this.context = Renderer.createContext();
	}

	private readonly wrappedComponent = (renderType: RenderType = "render", component: React.FC<any> = this.component, props: any = this.props, contexts: RenderContextMap = new Map()) =>
	{
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

		const ctxClone = new Map(contexts);

		const k = ctxClone.keys()[0];

		if (k)
		{
			const ctxVal = ctxClone.get(k);
			ctxClone.delete(k);
			return (
				<Renderer.renderContext.Provider value={{ ...this.context, renderType }}>
					<WrappedProvider ctx={k} value={ctxVal} otherContexts={ctxClone} />
				</Renderer.renderContext.Provider>
			);
		}

		return (
			<Renderer.renderContext.Provider value={{ ...this.context, renderType }}>
				{React.createElement(component, props)}
			</Renderer.renderContext.Provider>
		);
	}

	protected readonly resolveStatic = (component: React.FC<any>) =>
	{
		return ReactDOMServer.renderToStaticMarkup(this.wrappedComponent("static-render", component));
	}

	public readonly hydrate = async (el: HTMLElement) =>
	{
		let rootEl = document.getElementById("root");

		if (!rootEl)
		{
			rootEl = document.createElement("div");
			rootEl.id = "root";
			document.body.appendChild(rootEl);
		}

		await this.resolve();

		return ReactDOM.hydrateRoot(el, this.wrappedComponent());
	}

	public resolveToStaticHtml = async (component: React.FC<any>, props: any) =>
	{
		const renders = await this.resolve(component, props);
		return Static.inject(ReactDOMServer.renderToStaticMarkup(this.wrappedComponent("render", component, props)), renders);
	}

	public readonly render = async () =>
	{
		const staticRenders = await this.resolve();
		
		return Static.inject(ReactDOMServer.renderToString(this.wrappedComponent()), staticRenders);
	}

	protected readonly resolveAsync = async (component: React.FC<any> = this.component, props: any = this.props, contexts: RenderContextMap = new Map()) =>
	{
		ReactDOMServer.renderToStaticMarkup(this.wrappedComponent("resolving", component, props, contexts));

		await Async.resolveComponents(this.context.async, this.resolveAsync);
	}

	protected readonly resolve = async (component: React.FC<any> = this.component, props: any = this.props, contexts: RenderContextMap = new Map()) =>
	{
		ReactDOMServer.renderToStaticMarkup(this.wrappedComponent("resolving", component, props, contexts));

		await Async.resolveComponents(this.context.async, this.resolveAsync);
		
		return await Static.resolveComponents(this.context, this.resolveStatic, this.resolveToStaticHtml);
	}
}

export type RenderContextMap = Map<Context<any>, any>;

export type RenderContext = {
	contextStacks: Map<Context<any>, any[]>;
	renderType: RenderType;
	async: Async.ContextType;
	staticContext: Static.ContextType;
};

type RenderType = "resolving" | "hydrating" | "render" | "static-render";
