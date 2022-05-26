import React from "react";
import ReactDOM from "react-dom/client";
import ReactDOMServer from "react-dom/server";
import { Async } from "./Async";
import { Client } from "./Client";
import { ErrorHtml, Html, HtmlErrorProps, HtmlProps } from "./Html";
import { IonAppContext } from "./IonAppContext";
import { OnRouteResolveCallback, RedirectCallback } from "./Router";
import type { ApiImplementation, ApiManifest, ApiScheme } from "./server";
import type { Manifest } from "./server/Manifest";
import { getSSRData } from "./SSRData";
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

		public wrap(url: string, onRedirect: RedirectCallback, context: IonAppContext.Type = this.context)
		{
			return (
				<IonAppContext.Provider context={context} onRedirect={onRedirect} onResolveRoute={this.resolveRoute(clientFetcher)} url={url}>
					{React.createElement(this.fc)}
				</IonAppContext.Provider>
			);
		}

		public async resolve(url: string, onRedirect: RedirectCallback, fetcher: Fetcher, hydrate: boolean = false, ctx: Async.ContextType = this.context.async)
		{
			let context = IonAppContext.create(fetcher, !hydrate, hydrate, ctx);

			ReactDOMServer.renderToStaticMarkup(this.wrap(url, onRedirect, context));

			let newData = await Async.resolveComponents(context.async);

			while (Object.keys(newData).length > 0)
			{
				ctx.data = { ...ctx.data, ...newData };

				if (hydrate)
					ctx.cache = context.async.cache;

				context = IonAppContext.create(fetcher, !hydrate, hydrate, ctx);
				ReactDOMServer.renderToStaticMarkup(this.wrap(url, onRedirect, context));

				newData = await Async.resolveComponents(context.async);
			}

			if (hydrate)
				this.context.async.cache = context.async.cache;
		}

		protected async renderToString(url: string, onRedirect: RedirectCallback, appName: string, manifest: Manifest, fetcher: Fetcher, apiManifest: ApiManifest)
		{
			try
			{
				await this.resolve(url, onRedirect, fetcher, false);

				const paths = Async.getDynamicPaths(this.context.async);

				const appString = ReactDOMServer.renderToString(this.wrap(url, onRedirect));

				return ReactDOMServer.renderToStaticMarkup(React.createElement(this.options.html, {
					appString,
					scripts: manifest.get(appName, paths, "js"),
					styles: manifest.get(appName, paths, "css"),
					ssrData: {
						async: this.context.async.resolvedDataStack,
						api: apiManifest
					}
				}));
			}
			catch (e)
			{
				return ReactDOMServer.renderToStaticMarkup(React.createElement(this.options.errorHtml, {
					error: cloneError(e)
				}));
			}

		}

		public async render(url: string, onRedirect: RedirectCallback, appName: string, manifest: Manifest, fetcher: Fetcher, apiManifest: ApiManifest)
		{
			return await new IonApp.Component(this.fc, this.options).renderToString(url, onRedirect, appName, manifest, fetcher, apiManifest);
		}


		private readonly resolveRoute = (fetcher: IonApp.Fetcher) => async (from: string, to: string, token: CancelToken<string>, onResolve: () => any) => 
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
				await this.resolve(redirectedUrl, onRedirect, fetcher, false, ctx.async);
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

			Client.updateApi(ssrData.api);

			this.context.async.resolvedDataStack = ssrData.async;

			const url = window.location.pathname + window.location.search + window.location.hash;

			await this.resolve(url, () => { throw new Error("") }, clientFetcher, true);

			const rootElement = initRoot();

			ReactDOM.hydrateRoot(rootElement, this.wrap(url, () => true));
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
}
