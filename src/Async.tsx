import React from "react";
import { RenderContext, Renderer } from "./Renderer";
import { hash } from "./utils/string";
import { Context } from "./Context"
import { object } from "./utils";
import { cloneError } from "./utils/object";
import { Static } from "./Static";
import ReactDOM from "react-dom";

export namespace Async
{
	const defaultProps: Required<FCProps> = {
		cache: Infinity,
		prefetch: true,
	};

	const resolve = async (resolver: Resolver<any, any>, props: any): Promise<Data<any>> =>
	{
		try
		{
			return {
				data: await resolver(props),
				isLoading: false
			}
		}
		catch (e)
		{

			return {
				error: cloneError(e),
				isLoading: false
			}
		}
	}

	export const flushRenderStack = async (context: ContextType, renderStack: RenderStack) => context.renderStack = renderStack;

	export const resolveComponents = async (context: ContextType, onResolved: (component: React.FC<any>, props: any, context: Map<Context<any>, any>) => any) =>
	{
		const resolvers = object.moveAndReplace(context, "resolvers", {});
		let promises: Promise<any>[] = [];
		let ids: string[] = [];

		for (const id in resolvers)
		{
			const { props, resolver } = resolvers[id];
			promises.push(resolve(resolver, props));
			ids.push(id);
		}

		for (let i = 0; i < ids.length; i++)
		{
			const id =  ids[i];
			const data = await promises[i];
			const { components, props, stateDispatchers } = resolvers[id];
			
			context.data[id] = data;
			
			let resolvedPromises: Promise<any>[] = [];

			for (const { component, contexts } of components)
				resolvedPromises.push(onResolved(component, { ...props, ...data }, contexts));

			await Promise.all(resolvedPromises);

			if (stateDispatchers.length > 0)
				ReactDOM.unstable_batchedUpdates(() => stateDispatchers.forEach(s => s(data)));
		}
	}

	const getData = (context: RenderContext, id: string, isPrefetchComponent: boolean = false) => 
	{
		let data: Data<any> | undefined = context.async.data[id];

		if (data)
			return data;

		if (Renderer.isHydrating(context) && isPrefetchComponent)
		{
			data = context.async.renderStack[context.async.hydrateIndex++];
			context.async.data[id] = data;
		}

		return data;
	};

	const addAsyncResolver = (renderContext: RenderContext, id: string, fc: React.FC<any>, props: any, resolver: Resolver<any, any>, stateDispatcher?: (state: Data<any>) => any) =>
	{
		const data = {
			isLoading: true,
		};

		const resolveInfo = {
			component: fc,
			props,
			contexts: Renderer.copyCurrentContexts(renderContext)
		};

		if (!renderContext.async.resolvers[id])
		{
			renderContext.async.resolvers[id] = {
				components: [resolveInfo],
				props,
				resolver,
				stateDispatchers: []
			};
		}
		else
		{
			renderContext.async.resolvers[id].components.push(resolveInfo);
		}

		if (stateDispatcher)
		{
			renderContext.async.resolvers[id].stateDispatchers.push(stateDispatcher)
		}

		return data;
	}

	export const create = <Props extends {}, D>(resolver: Resolver<Props, D>, fc: React.FC<Props & Data<D extends Promise<infer P> ? P : D>>, defaultAsyncProps: Required<FCProps> = defaultProps): FC<Props> =>
	{
		const c = ((props: Props & FCProps) => 
		{
			const { cache, prefetch, ...rest } = { ...defaultAsyncProps, ...props };

			const fcProps = rest as any as Props;

			const createId = () => `${c.id}.${hash(JSON.stringify(props))}`;

			const propsSignature = React.useMemo(() => hash(JSON.stringify(fcProps)), [props]);

			const id = React.useMemo(createId, [props]);

			const renderContext = Renderer.useContext();

			const [state, setState] = React.useState<Data>(() => 
			{
				let data = getData(renderContext, id, prefetch);

				if (data)
					return data;

				if (Renderer.isResolving(renderContext) && prefetch)
					return addAsyncResolver(renderContext, id, fc, fcProps, resolver);

				return {
					isLoading: true
				};
			});

			if (env.isServer && !Renderer.isResolving(renderContext))
				renderContext.async.renderStack.push(state);

			React.useEffect(() => 
			{
				const newSignature = hash(JSON.stringify(fcProps));
				if (newSignature != propsSignature)
				{

				}
				else
				{
					let data = getData(renderContext, id, prefetch);

					if (!data)
					{
						if (renderContext.async.didMount)
						{
							console.log("resolve and did mount");
							resolve(resolver, fcProps).then(d => 
							{
								if(id === createId())
								{
									renderContext.async.data[id] = d;
									setState(d);
								}
							});
							renderContext.async.data[id] = state;
						}
						else
						{
							addAsyncResolver(renderContext, id, fc, fcProps, resolver, setState);
						}
					}
				}
				return () =>
				{

				}
			}, [fcProps]);

			if (Renderer.isStaticRender(renderContext))
				return Static.renderAsDynamicComponent(c, props, id);

			return React.createElement(fc, { ...fcProps, ...state });
		}) as FC<Props>;

		c.id = hash(fc.toString());

		return c;
	}

	export const createResolver = <P extends {}, Data>(fn: (props: P) => Data): Resolver<P, Data> => fn;

	export type Resolver<Props extends {}, Data> = (data: Omit<Props, keyof FCProps | "children"> & {}) => (Promise<Data> | Data);

	type FC<P extends {}> = React.FC<P & FCProps> & {
		id: number;
	};

	type FCProps = {
		prefetch?: boolean;
		cache?: number | CacheOptions;
	};

	type CacheOptions = {
		duration: number;
	};

	export type ContextType = {
		didMount: boolean;
		data: DataMap;
		resolvers: ResolversMap;
		renderStack: RenderStack;
		hydrateIndex: number;
	};

	type Data<T = any> = {
		data?: T;
		error?: Error;
		isLoading: boolean;
	};

	export type DataMap = {
		[key: string]: Data<any>;
	};

	type ResolverInfo = {
		component: React.FC<any>;
		contexts: Map<Context<any>, any>;
	};

	type ResolversMap = {
		[key: string]: {
			props: any;
			components: ResolverInfo[];
			resolver: Resolver<any, any>;
			stateDispatchers: ((state: Data<any>) => any)[];
		};
	};

	type RenderStack = Data[];
}
