import { Request, Response } from "express";
import type { IonApp } from "../IonApp";
import { Manifest } from "./Manifest";

export class Renderer
{
	protected readonly component: IonApp.Component<any>;
	protected readonly req: any;
	protected readonly res: Response<any, Record<string, any>>;

	constructor(component: IonApp.Component<any>, req: Request, res: Response)
	{
		this.component = component;
		this.req = req;
		this.res = res;
	}

	public async render(appName: string, manifest: Manifest)
	{
		return await this.component.render(appName, manifest);
	}
}

export type RendererType<T extends Renderer> = new (component: IonApp.Component<any>, req: Request, res: Response) => T;
