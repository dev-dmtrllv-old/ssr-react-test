import React from "react";
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

	const createId = <Props extends {} = {}, Data = any>(resolver: Resolver<Props, Data>, component: React.FC<Props & ComponentData<Data>>): string =>
	{
		return `${hash(resolver.toString())}.${hash(component.toString())}`;
	}

	const createPropId = <Props extends {}, Data>(componentID: string, props: Props): string =>
	{
		return `${componentID}.${hash(JSON.stringify(props))}`;
	}

	const getData = <T extends any = any>(ctx: ContextType, id: string): Data<T> | undefined =>
	{
		return ctx.data[id];
	}

	const resolveComponent = <P extends {}, Data>(ctx: ContextType, id: string, component: Component<P, Data>, props: P) =>
	{
		ctx.resolvingComponents[id] = { component, props };
	}

	export const create = <Props extends {}, Data>(resolver: Resolver<Props, Data>, component: React.FC<Props & ComponentData<Data>>): Component<Props, Data> =>
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
					resolveComponent(ctx, idRef.current, c, props);

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
		}) as unknown as Component<Props, Data>;

		c.id = componentID;
		c.component = component;

		return c;
	}


	type Resolver<Props extends {}, Data> = (data: Props & {}) => Data;

	interface Component<Props extends {}, Data> extends React.FunctionComponent<Props & AsyncProps>
	{
		id: string;
		component: React.FC<Props & ComponentData<Data>>;
	};

	type AsyncProps = {
		cache?: CacheOptions | CacheOptions["duration"];
		prefetch?: boolean;
	};

	type ContextType = {
		data: DataMap;
		resolvingComponents: ResolvingComponentsMap;
	};

	type DataMap = {
		[key: string]: Data<any>;
	};

	type ResolvingComponentsMap = {
		[key: string]: {
			props: any;
			component: Component<any, any>;
		};
	}

	type ComponentData<T> = {
		data?: T;
		error?: Error;
		isLoading: boolean;
		isInvalidated: boolean;
	};

	type Data<T> = ComponentData<T> & {
		cache?: CacheOptions;
	};

	type CacheOptions = {
		duration: number;
		invalidate?: boolean;
	};

}
