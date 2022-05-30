import React from "react";
import { hash } from "./utils/string";

export namespace Static
{
	const Context = React.createContext<ContextType>({
		components: {}
	});


	const AutoDynamicContext = React.createContext<AutoDynamicContextType | null>({
		dynamic: (component, props) => React.createElement(component, props),
	});

	export const useAutoDynamicContext = () =>
	{
		return React.useContext(AutoDynamicContext);
	}

	const staticRenders: RenderMap = {};

	export const Provider = ({ children, context }: React.PropsWithChildren<{ context: ContextType }>) =>
	{
		return (
			<Context.Provider value={context}>
				{children}
			</Context.Provider>
		);
	};

	const createComponentID = (component: React.FC<any>) => hash(component.toString());

	const createID = (componentID: number, props: any) => `${componentID}.${hash(JSON.stringify(props))}`;

	export const injectStaticComponents = (html: string, staticRenderResult: RenderResult) =>
	{
		Object.keys(staticRenderResult).forEach(k => html = html.replaceAll(k, staticRenderResult[k]));
		return html;
	}

	export const getStaticRenderInfo = (id: string): RenderInfo | undefined => staticRenders[id];

	export const resolveComponents = async (context: ContextType, onResolve: ResolveCallback) =>
	{
		const staticRenderResult: RenderResult = {};

		const components = context.components;

		context.components = {};

		for (const id in components)
		{
			let info = getStaticRenderInfo(id);

			if (!info)
			{
				const { component, props } = components[id];

				const dynamicComponents: { [id: string]: DynamicComponentInfo<any> } = {};

				const dynamic: DynamicResolver = (c, props: any = {}) => 
				{
					const id = hash(c.toString()) + "." + hash(JSON.stringify(props));
					dynamicComponents[id] = { component: c, props };
					return id;
				}

				const p: ComponentProps = {
					...props,
					dynamic,
				};

				let html = await onResolve(() => <AutoDynamicContext.Provider value={{ dynamic }}>{React.createElement(component, p)}</AutoDynamicContext.Provider>, {});
				// console.log(`resolved static render with html: ${html}`);
				for (const id in context.components)
				{
					const info = getStaticRenderInfo(id);
					if (info)
						html = html.replaceAll(id, info.html);
				}

				info = { html, dynamic: dynamicComponents };

				staticRenders[id] = info;
			}

			let html = info.html;

			for (const id in info.dynamic)
			{
				const { component, props } = info.dynamic[id];
				const dynamicHtml = await onResolve(component, props);

				html = html.replaceAll(id, dynamicHtml);
			}
			console.log(info.dynamic);
			staticRenderResult[id] = html;
		}

		return staticRenderResult;
	}

	export const create = <P extends {}>(component: React.FC<P & ComponentProps>): Component<P> =>
	{
		const c: Component<P> = ((props: P) => 
		{
			if (env.isClient)
				return React.createElement(component, { ...props, dynamic: (component, props) => React.createElement(component, props) });
			
			const idRef = React.useRef(createID(c.id, props));

			const { components } = React.useContext(Context);

			const id = idRef.current;

			if (!components[id])
				components[id] = { component, props };

			return id;
		}) as any;

		c.id = createComponentID(component);

		return c;
	}

	export type ContextType = {
		components: {
			[id: string]: ComponentInfo<any>;
		}
	};

	type AutoDynamicContextType = ComponentProps;

	type Component<P extends {}> = React.FC<P> & {
		id: number;
	};

	type ComponentInfo<P extends {}> = {
		component: React.FC<P>;
		props: P;
	};

	type RenderInfo = {
		html: string;
		dynamic: {
			[id: string]: DynamicComponentInfo<any>;
		}
	};

	type RenderMap = {
		[id: string]: RenderInfo;
	};

	type ResolveCallback = <P extends {}>(component: React.FC<P>, props: P) => Promise<string>;

	type DynamicComponentInfo<P extends {}> = {
		component: React.FC<P>;
		props: P;
	};

	export type DynamicResolver = <C extends React.FC<P>, P extends {}>(component: C, props?: P) => JSX.Element | string;

	type ComponentProps = {
		dynamic: DynamicResolver;
	};

	export type RenderResult = {
		[key: string]: string;
	};

}
