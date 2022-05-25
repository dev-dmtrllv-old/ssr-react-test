import { Request, Response } from "express";
import type { IonApp } from "../IonApp";
import { isClass } from "../utils/object";
import { Manifest } from "./Manifest";
import type { Server } from "./Server";
import nodeFetch from "node-fetch";
import { Session } from "./ApiSession";
import { object } from "../utils";

export class Renderer
{
	protected readonly server: Server;
	protected readonly component: IonApp.Component<any>;
	protected readonly req: Request;
	protected readonly res: Response<any, Record<string, any>>;
	public readonly session: Session;

	constructor(server: Server, component: IonApp.Component<any>, req: Request, res: Response)
	{
		this.server = server;
		this.component = component;
		this.req = req;
		this.res = res;
		this.session = new Session(req);
	}

	private readonly fetcher: IonApp.Fetcher = async (_url, options) =>
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
			throw response;
		}
	}

	public async render(appName: string, manifest: Manifest)
	{
		const html = await this.component.render(appName, manifest, this.fetcher, this.server.apiManifest);
		this.res.send(html);
		return true;
	}
}
