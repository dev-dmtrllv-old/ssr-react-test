import React from "react";
import { cloneError } from "./utils/object";
import { hash } from "./utils/string";

export namespace Async
{
	const Context = React.createContext<ContextType>({
		data: {},
		resolvingComponents: {},
	});

	export const Provider = ({ ctx, children }: React.PropsWithChildren<{ ctx: ContextType }>) =>
	{
		return (
			<Context.Provider value={ctx}>
				{children}
			</Context.Provider>
		);
	}

	export const useContext = () => React.useContext(Context);

	const resolveComponent = async <Props extends {}, Data>(component: AsyncComponent<Props, Data>, props: Props) =>  
	{
		let data: Data | undefined = undefined;
		let error: Error | undefined = undefined;

		try
		{
			data = await component.resolver(props);
		}
		catch (e)
		{
			error = cloneError(e);
		}

		return {
			data,
			error,
			isInvalidated: false,
			isLoading: false,
		};
	}

	export const resolveComponents = async (ctx: ContextType): Promise<DataMap> =>
	{
		const idMap: string[] = [];

		const promises: Promise<any>[] = [];

		for (const id in ctx.resolvingComponents)
		{
			const { component, props } = ctx.resolvingComponents[id];
			idMap.push(id);
			promises.push(resolveComponent(component, props));
		}

		let map: DataMap = {};

		const responses = await Promise.all(promises);

		for(let i = 0, l = idMap.length; i < l; i++)
			map[idMap[i]] = responses[i];
		
		return map;
	}

	const createId = <Props extends {} = {}, Data = any>(resolver: Resolver<Props, Data>, component: React.FC<Props & ComponentData<Data>>): string =>
	{
		return `${hash(resolver.toString())}.${hash(component.toString())}`;
	}

	const createPropId = <Props extends {}, Data>(componentID: string, props: Props): string =>
	{
		return `${componentID}.${hash(JSON.stringify(props))}`;
	}

	const getData = <T extends any = any>(ctx: ContextType, id: string): AsyncData<T> | undefined =>
	{
		return ctx.data[id];
	}

	const addResolvingComponent = <P extends {}, Data>(ctx: ContextType, id: string, component: AsyncComponent<P, Data>, props: P) =>
	{
		ctx.resolvingComponents[id] = { component, props };
	}

	export const create = <Props extends {}, Data>(resolver: Resolver<Props, Data>, component: React.FC<Props & ComponentData<Data>>): AsyncComponent<Props, Data> =>
	{
		const componentID = createId(resolver, component);

		const c = ((props) =>
		{
			const ctx = useContext();

			const idRef = React.useRef(createPropId(componentID, props));

			const [state, setState] = React.useState<ComponentData<Data>>(() => 
			{
				let data = getData(ctx, idRef.current);

				if (data)
				{
					const { cache, ...rest } = data;
					return rest;
				}

				if (props.prefetch)
					addResolvingComponent(ctx, idRef.current, c, props);

				return {
					isInvalidated: false,
					isLoading: true,
				};
			});

			React.useEffect(() => 
			{
				const id = idRef.current;
				const newID = createPropId(componentID, props);
				if (id !== newID) // on props change
				{
					idRef.current = newID;
				}
				else // on mount
				{

				}
				return () => // on unmount
				{

				}
			}, [props]);

			const { cache, prefetch, ...rest } = props as AsyncProps & Props;

			return React.createElement(component, { ...rest as any, ...state });
		}) as unknown as AsyncComponent<Props, Data>;

		c.id = componentID;
		c.component = component;
		c.resolver = resolver;

		return c;
	}


	type Resolver<Props extends {}, Data> = (data: Props & {}) => Data;

	export interface AsyncComponent<Props extends {}, Data> extends React.FunctionComponent<Props & AsyncProps>
	{
		id: string;
		component: React.FC<Props & ComponentData<Data>>;
		resolver: Resolver<Props, Data>;
	};

	type AsyncProps = {
		cache?: CacheOptions | CacheOptions["duration"];
		prefetch?: boolean;
	};

	export type ContextType = {
		data: DataMap;
		resolvingComponents: ResolvingComponentsMap;
	};

	type DataMap = {
		[key: string]: AsyncData<any>;
	};

	type ResolvingComponentsMap = {
		[key: string]: {
			props: any;
			component: AsyncComponent<any, any>;
		};
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
