import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Async } from "./Async";
import { Client } from "./Client";
import { ErrorHtml, Html, HtmlErrorProps, HtmlProps } from "./Html";
import { IonAppContext } from "./IonAppContext";
import { RedirectCallback } from "./Router";
import type { ApiImplementation, ApiManifest, ApiScheme } from "./server";
import type { Manifest } from "./server/Manifest";
import SSRData, { getSSRData } from "./SSRData";
import { Static } from "./Static";
import { CancelToken } from "./utils";
import { cloneError } from "./utils/object";

export namespace IonApp
{
	export const clientFetcher: Fetcher = async (url, options) =>
	{
		const response = await fetch(url as RequestInfo, { ...options, credentials: "include" });
		const data = await response.text();
		try
		{
			let r = JSON.parse(data);
			if (r.data)
				return r.data;
			else if (r.error)
				throw r.error;
			return r;
		}
		catch
		{
			return data;
		}
	}

	const defaultOptions: Required<Options> = {
		html: Html,
		errorHtml: ErrorHtml
	};

	export class Component<T extends React.FC<any>>
	{
		public readonly fc: T;
		public readonly options: Required<Options>;
		public readonly context: IonAppContext.Type;

		public constructor(fc: T, options: Options = {})
		{
			this.fc = fc;
			this.options = { ...defaultOptions, ...options };
			this.context = IonAppContext.create(env.isClient ? clientFetcher : async () => { }, false);
		}

		public wrap(title: string, url: string, onRedirect: RedirectCallback, onTitleChange: (title: string) => any = () => { }, context: IonAppContext.Type = this.context, component: React.FC<any> = this.fc, props: any = {})
		{
			return (
				<IonAppContext.Provider context={context} onRedirect={onRedirect} onResolveRoute={this.resolveRoute(title, clientFetcher)} title={title} url={url} onTitleChange={onTitleChange}>
					{React.createElement(component, props)}
				</IonAppContext.Provider>
			);
		}

		public async resolve(title: string, url: string, onRedirect: RedirectCallback, fetcher: Fetcher, hydrate: boolean = false, ctx: Async.ContextType = this.context.async, component: React.FC<any> = this.fc, props: any = {}): Promise<ResolveData>
		{
			let resolvedTitle = title;

			let context = IonAppContext.create(fetcher, !hydrate, hydrate, ctx);

			ReactDOMServer.renderToStaticMarkup(this.wrap(title, url, onRedirect, (t) => resolvedTitle = t, context, component, props));

			let newData = await Async.resolveComponents(context.async);
			// console.log(newData);
			while (Object.keys(newData).length > 0)
			{
				ctx.data = { ...ctx.data, ...newData };

				if (hydrate)
					ctx.cache = context.async.cache;

				context = IonAppContext.create(fetcher, !hydrate, hydrate, ctx);
				ReactDOMServer.renderToStaticMarkup(this.wrap(title, url, onRedirect, (t) => resolvedTitle = t, context, component, props));

				newData = await Async.resolveComponents(context.async);
			}

			if (hydrate)
				this.context.async.cache = context.async.cache;

			return {
				title: resolvedTitle,
				staticComponents: context.staticContext.components
			}
		}

		protected async renderAppString(title: string, url: string, onRedirect: RedirectCallback, fetcher: IonApp.Fetcher, component: React.FC<any> = this.fc, props: any = {}): Promise<{ appString: string, title: string, dynamicPaths: string[] } | false>
		{
			let continueRender = true;

			const onRedirectWrapper = (to: string) =>
			{
				continueRender = onRedirect(to);
				return continueRender;
			}

			const resolvedData = await this.resolve(title, url, onRedirectWrapper, fetcher, false, this.context.async, component, props);

			this.context.staticContext.components = resolvedData.staticComponents;
			// console.log(this.context.staticContext);
			if (!continueRender)
				return false;
			
			const resolveStaticComponent = async <P extends {}>(component: React.FC<P>, props: P) =>
			{
				const result = await this.renderAppString(title, url, onRedirect, fetcher, component, props);
				// console.log(result);
				if (result)
					return result.appString;
				return "";
			}
			// Async.resolveComponents
			const dynamicPaths = Async.getDynamicPaths(this.context.async);
			
			const staticRenders = await Static.resolveComponents(this.context.staticContext, resolveStaticComponent);
			
			let updatedTitle = title;

			const appString = Static.injectStaticComponents(ReactDOMServer.renderToString(this.wrap(title, url, onRedirect, (t) => updatedTitle = t, this.context, component, props)), staticRenders);

			return { appString, title: resolvedData.title, dynamicPaths };
		}


		protected async renderToString(title: string, url: string, onRedirect: RedirectCallback, appName: string, manifest: Manifest, fetcher: Fetcher, apiManifest: ApiManifest, apps: SSRData["apps"])
		{
			try
			{
				const renderResult = await this.renderAppString(title, url, onRedirect, fetcher);

				if (renderResult)
				{
					const { appString, dynamicPaths, title } = renderResult;
					renderResult.appString;

					return ReactDOMServer.renderToStaticMarkup(React.createElement(this.options.html, {
						title,
						appString,
						scripts: manifest.get(appName, dynamicPaths, "js"),
						styles: manifest.get(appName, dynamicPaths, "css"),
						ssrData: {
							async: this.context.async.resolvedDataStack,
							api: apiManifest,
							apps,
							title
						}
					}));
				}
			}
			catch (e)
			{
				console.error(e);
				return ReactDOMServer.renderToStaticMarkup(React.createElement(this.options.errorHtml, {
					error: cloneError(e)
				}));
			}
		}

		public async render(title: string, url: string, onRedirect: RedirectCallback, appName: string, manifest: Manifest, fetcher: Fetcher, apiManifest: ApiManifest, apps: SSRData["apps"])
		{
			return await new IonApp.Component(this.fc, this.options).renderToString(title, url, onRedirect, appName, manifest, fetcher, apiManifest, apps);
		}


		private readonly resolveRoute = (title: string, fetcher: IonApp.Fetcher) => async (from: string, to: string, token: CancelToken<string>, onResolve: () => any) => 
		{
			let ctx = IonAppContext.create(fetcher, true, false, this.context.async);

			let passedUrls = [from];

			let redirected = true;

			let redirectedUrl = to;

			const onRedirect: RedirectCallback = (rurl) =>
			{
				redirectedUrl = rurl;
				redirected = true;

				return false;
			}

			while (redirected)
			{

				if (passedUrls.includes(redirectedUrl))
				{
					console.warn(`redirect cycle detected! [${[...passedUrls, redirectedUrl].join(" -> ")}]`);
					return from;
				}
				else
				{
					passedUrls.push(redirectedUrl);
				}
				ctx = IonAppContext.create(fetcher, true, false, this.context.async);
				redirected = false;
				await this.resolve(title, redirectedUrl, onRedirect, fetcher, false, ctx.async);
				if (token.isCanceled)
					return from;
			}

			this.context.async.data = ctx.async.data;

			return redirectedUrl;
		}

		public async mount()
		{
			const rootID = "root";

			const initRoot = () =>
			{
				let rootElement = document.getElementById(rootID);
				if (!rootElement)
				{
					rootElement = document.createElement("div");
					rootElement.id = rootID;
					document.body.appendChild(rootElement);
				}
				return rootElement;
			};

			const ssrData = getSSRData();

			console.log(ssrData);

			Client.updateApi(ssrData.api);

			this.context.async.resolvedDataStack = ssrData.async;

			const url = window.location.pathname + window.location.search + window.location.hash;

			await this.resolve(ssrData.title, url, () => { throw new Error("") }, clientFetcher, true);

			const rootElement = initRoot();

			ReactDOM.hydrateRoot(rootElement, this.wrap(ssrData.title, url, () => true));
		}

		public updateApiForServer = <T extends ApiScheme>(apiBasePath: string, apiImplementation: ApiImplementation<T>) => Client.updateApiForServer(apiBasePath, apiImplementation)
	}

	export const create = <T extends React.FC<any>>(fc: T, options: Options = {}): Component<T> =>
	{
		const c = new Component(fc, options);

		if (!env.isServer)
			c.mount();

		return c;
	}

	type Options = {
		html?: React.FC<HtmlProps>;
		errorHtml?: React.FC<HtmlErrorProps<{}>>;
	};

	export type Fetcher = (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<any>;

	type ResolveData = {
		title: string;
		staticComponents: Static.ContextType["components"];
	};
}
