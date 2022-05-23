import { Request, Response } from "express";
import type { IonApp } from "../IonApp";
import { cloneError, isClass } from "../utils/object";
import { Manifest } from "./Manifest";
import type { Server } from "./Server";
import nodeFetch from "node-fetch";

export class Renderer
{
	protected readonly server: Server;
	protected readonly component: IonApp.Component<any>;
	protected readonly req: Request;
	protected readonly res: Response<any, Record<string, any>>;

	constructor(server: Server, component: IonApp.Component<any>, req: Request, res: Response)
	{
		this.server = server;
		this.component = component;
		this.req = req;
		this.res = res;
	}

	private readonly fetcher: IonApp.Fetcher = async (_url, options) =>
	{
		let url = isClass(_url, URL) ? _url.href : _url.toString();

		if (url.startsWith("/"))
			url = `http://${this.server.host + ":" + this.server.port}${url}`;

		try
		{
			let data = await nodeFetch(url as any, options as any);
			data = await data.text();

			if (["{", "[", "\""].includes(data[0]))
			{
				try
				{
					return JSON.parse(data);
				}
				catch
				{
					return data;
				}
			}
			return data;
		}
		catch (e)
		{
			throw e;
		}
		// }
	}

	public async render(appName: string, manifest: Manifest)
	{
		const html = await this.component.render(appName, manifest, this.fetcher);
		this.res.send(html);
		return true;
	}
}

export type RendererType<T extends Renderer> = new (component: IonApp.Component<any>, req: Request, res: Response) => T;
