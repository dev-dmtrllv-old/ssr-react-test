import React from "react";
import { IonAppContext } from "./IonAppContext";
import { cloneError } from "./utils/object";
import { hash } from "./utils/string";

export namespace Async
{
	const componentMap: AsyncComponent<any, any>[] = [];

	const Context = React.createContext<ContextType>({
		data: {},
		resolvers: {},
		resolvedDataStack: []
	});

	export const Provider = ({ context, children }: React.PropsWithChildren<{ context: ContextType }>) =>
	{
		return (
			<Context.Provider value={context}>
				{children}
			</Context.Provider>
		);
	}

	const createId = <P extends {}>(id: number, props: P) => hash(`${id}.${JSON.stringify(props)}`);

	const resolve = <P extends {}, D>(resolver: Resolver<P, D>, props: P) => new Promise<AsyncData<D>>(async (res) => 
	{
		let data: D | undefined = undefined;
		let error: Error | undefined = undefined;

		try
		{
			data = await resolver(props);
		}
		catch (e)
		{
			error = cloneError(e);
		}

		res({
			isInvalidated: false,
			isLoading: false,
			data,
			error,
		});
	});

	export const resolveComponents = async (context: ContextType) =>
	{
		let promises: Promise<any>[] = [];

		Object.keys(context.resolvers).forEach(id => 
		{
			const [resolver, props] = context.resolvers[id];
			promises.push(resolve(resolver, props));
		});

		const data = await Promise.all(promises);

		const map: DataMap = {};

		Object.keys(context.resolvers).forEach((k, i) => map[k] = data[i]);

		return map;
	}

	export const useContext = () => React.useContext(Context);

	export const create = <Props extends {}, Data>(resolver: Resolver<Props, Data>, component: React.FC<Props & ComponentData<Data>>): AsyncComponent<Props, Data> =>
	{
		const c = (({ cache, prefetch, ...props }: Props & ComponentData<Data> & { resolveIndex?: number } & AsyncProps) =>
		{
			prefetch = prefetch === undefined ? true : prefetch;

			const ctx = useContext();
			const { isResolving, isClient, isServer, isHydrating } = IonAppContext.use();

			const id = createId(c.id, props);

			const [state, setState] = React.useState(() => 
			{
				if (isHydrating)
				{
					const d = ctx.resolvedDataStack.shift();
					if (d)
					{
						ctx.data[id] = d;
						return d;
					}
				}
				else if (ctx.data[id])
					return ctx.data[id];
				else if (isResolving && prefetch)
					ctx.resolvers[id] = [resolver, props];

				return {
					isLoading: true,
					isInvalidated: false,
				};
			});

			if (isServer && !isResolving)
			{
				ctx.resolvedDataStack.push(state);
			}

			return React.createElement(component, { ...props as any, ...state });
		}) as unknown as AsyncComponent<Props, Data>;

		c.id = hash(resolver.toString());
		c.component = component;
		c.resolver = resolver;

		componentMap.push(c);

		return c;
	}


	type Resolver<Props extends {}, Data> = (data: Props & {}) => Data;

	export interface AsyncComponent<Props extends {}, Data> extends React.FunctionComponent<Props & AsyncProps>
	{
		id: number;
		component: React.FC<Props & ComponentData<Data>>;
		resolver: Resolver<Props, Data>;
	};

	type AsyncProps = {
		cache?: CacheOptions | CacheOptions["duration"];
		prefetch?: boolean;
	};

	export type ContextType = {
		data: DataMap;
		resolvers: Resolvers;
		resolvedDataStack: AsyncData<any>[];
	};

	type DataMap = {
		[key: number]: AsyncData<any>;
	};

	type Resolvers = {
		[key: string]: [Resolver<any, any>, any];
	}

	type ComponentData<T> = {
		data?: T | undefined;
		error?: Error | undefined;
		isLoading: boolean;
		isInvalidated: boolean;
	};

	type AsyncData<T> = ComponentData<T> & {
		cache?: CacheOptions;
	};

	type CacheOptions = {
		duration: number;
		invalidate?: boolean;
	};
}
