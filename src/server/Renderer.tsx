import { Request, Response } from "express";
import { IonAppComponent } from "./types";

export class Renderer
{
	protected readonly component: IonAppComponent;
	protected readonly req: any;
	protected readonly res: Response<any, Record<string, any>>;

	constructor(component: IonAppComponent, req: Request, res: Response)
	{
		this.component = component;
		this.req = req;
		this.res = res;
	}

	public async render()
	{
		return await this.component.render();
	}
}

export type RendererType<T extends Renderer> = new (component: IonAppComponent, req: Request, res: Response) => T;
