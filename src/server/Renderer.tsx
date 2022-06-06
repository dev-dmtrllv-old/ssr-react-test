import { Request, Response } from "express";
import type { IonApp } from "../IonApp";
import { cloneError, isClass } from "../utils/object";
import type { Server } from "./Server";
import nodeFetch from "node-fetch";
import { Session } from "./ApiSession";
import { object } from "../utils";
import ReactDOMServer from "react-dom/server";
import React from "react";
import { HtmlProps } from "../Html";

export class Renderer
{
	protected readonly server: Server;
	protected readonly appUrl: string;
	protected readonly component: IonApp;
	protected readonly req: Request;
	protected readonly res: Response<any, Record<string, any>>;
	public readonly session: Session;

	constructor(server: Server, appUrl: string, component: IonApp, req: Request, res: Response)
	{
		this.server = server;
		this.appUrl = appUrl;
		this.component = component;
		this.req = req;
		this.res = res;
		this.session = new Session(req);
	}

	private readonly fetcher: any = async (_url, options) =>
	{
		let url = isClass(_url, URL) ? _url.href : _url.toString();

		const apiBasePath = this.server.appConfig.serverApiPath;

		const apiUrl = `${this.server.host}:${this.server.port}/${apiBasePath}`;

		const tests = [apiBasePath, apiUrl, `http://${apiUrl}`, `https://${apiUrl}`];

		const matchedApi = tests.find(s => url.startsWith(s));

		if (matchedApi)
		{
			const [apiPath, query = ""] = url.replace(/https?:\/\/(.+)\//gi, "/").replace(apiBasePath, "").split("?");

			if (this.server.api.flat[apiPath])
			{
				const api = new this.server.api.flat[apiPath][0](this.session);
				const method = options?.method?.toLowerCase() || "get" as any;
				const data = method === "get" ? object.deserialize(query) : (options?.body ? JSON.parse(options.body as string) : {});
				const response = await api[method](data);
				this.req.session && await new Promise((res) => this.req.session.save(res));
				return response;
			}

			throw new Error(`Could not ${options?.method || "get"} Api ${apiPath}!`);

		}

		let response: any = await nodeFetch(url as any, { ...options as any, credentials: "include" });
		response = await response.text();

		try
		{
			const data = JSON.parse(response);
			if (data.data)
				return data.data;
			else if (data.error)
				throw data.error;
			return data;
		}
		catch
		{
			return response;
		}
	}

	public async render(appName: string, title: string)
	{
		try
		{
			const onRedirect = (url: string) =>
			{
				this.res.redirect(url);
				return false;
			}

			const renderResult = await this.component.renderServer(this.req.url, title, onRedirect);

			if (renderResult.didRedirect)
				return;

			const { Html, appString, asyncStack } = renderResult;

			const apps = {};

			Object.keys(this.server.appsSSRData).forEach(k => 
			{
				if (k !== this.appUrl)
					apps[k] = this.server.appsSSRData[k];
			});

			const props: HtmlProps = {
				appString,
				ssrData: {
					async: asyncStack,
					api: this.server.apiManifest,
					apps,
					title: title,
					appUrl: this.appUrl
				},
				styles: this.server.manifest.get(appName, [], "css"),
				scripts: this.server.manifest.get(appName, [], "js"),
				title: renderResult.title
			};

			const html = ReactDOMServer.renderToStaticMarkup(React.createElement(Html, props));

			this.res.send("<!DOCTYPE html>" + html);

			return true;
		}
		catch (e)
		{
			console.error(e);
			this.res.json(cloneError(e));
			return true;
		}
	}
}
