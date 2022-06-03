import React from "react";
import { RenderContext, Renderer } from "./Renderer";
import { object } from "./utils";
import { hash } from "./utils/string";

export namespace Static
{
	const staticRenders: Renders = {};

	const DynamicContext = React.createContext<DynamicContextType>({
		dynamic: (component: React.FC<any>, props: any = {}, id?: string) => React.createElement(component, props),
	});

	const DynamicProvider = ({ context, children }: React.PropsWithChildren<{ context: DynamicContextType }>) =>
	{
		return (
			<DynamicContext.Provider value={context}>
				{children}
			</DynamicContext.Provider>
		)
	}

	export const renderAsDynamicComponent = <P extends {}>(component: React.FC<P>, props: P, id?: string) => React.useContext(DynamicContext).dynamic(component, props, id);

	const createDynamicID = (component: React.FC<any>, props: any) => `${hash(component.toString())}.${hash(JSON.stringify(props))}`;

	export const inject = (html: string, renders: ResolvedRenders) => 
	{
		for (const id in renders)
			html = html.replaceAll(id, renders[id]);
		return html;
	};

	export const resolveComponents = async (context: RenderContext, resolveCallback: (component: React.FC<any>) => string, resolveDynamic: (component: React.FC<any>, props: any) => Promise<string>): Promise<ResolvedRenders> =>
	{
		const components = object.moveAndReplace(context.staticContext, "components", {});

		const renderResult: ResolvedRenders = {};

		for (const id in components)
		{
			if (!staticRenders[id])
			{
				const { component, props } = components[id];

				let dynamicComponents: { [key: string]: DynamicComponentInfo } = {};

				const dynamicContext: DynamicContextType = {
					dynamic: (component, props = {} as any, id = createDynamicID(component, props)) =>
					{
						dynamicComponents[id] = { component, props };
						return id;
					},
				};

				const html = resolveCallback(() => <DynamicProvider context={dynamicContext}>{React.createElement(component, { ...props, dynamic: dynamicContext.dynamic })}</DynamicProvider>);

				const renders = await resolveComponents(context, resolveCallback, resolveDynamic);

				staticRenders[id] = { html: inject(html, renders), dynamicComponents };
			}

			const render = staticRenders[id];

			let html = render.html;

			for (const id in render.dynamicComponents)
			{
				const { component, props } = render.dynamicComponents[id];
				const resolvedHtml = await resolveDynamic(component, props);
				html = html.replaceAll(id, resolvedHtml);
			}

			renderResult[id] = html;
		}

		return renderResult;
	}

	export const create = <P extends {}>(fc: React.FC<P & StaticProps>): FC<P> =>
	{
		const componentID = hash(fc.toString());

		return ({ ...props }: P & StaticProps) => 
		{
			const { staticContext } = Renderer.useContext();

			if (env.isServer)
			{
				const id = `${componentID}.${hash(JSON.stringify(props))}`;
				staticContext.components[id] = {
					component: fc,
					props
				};
				return id as any;
			}

			return React.createElement(fc, { ...props });
		};
	}

	type ResolvedRenders = { [key: string]: string };

	type DynamicContextType = {
		dynamic: DynamicWrapper;
	};

	type DynamicComponentInfo<P extends {} = {}> = {
		component: React.FC<P>;
		props: P;
	}

	type StaticComponentProps = {

	}

	type FC<P> = React.FC<P & StaticComponentProps>;

	type DynamicWrapper = <P extends {}>(component: React.FC<P>, props?: P, id?: string) => React.FunctionComponentElement<any> | string;

	type StaticProps = {
		dynamic: DynamicWrapper;
	};

	type Renders = {
		[key: string]: RenderInfo;
	};

	type DynamicComponentMap = {
		[key: string]: DynamicComponentInfo;
	};

	type RenderInfo = {
		html: string;
		dynamicComponents: DynamicComponentMap;
	};

	export type ContextType = {
		components: {
			[key: string]: {
				component: React.FC<any>;
				props: any;
			};
		}
	};
}
