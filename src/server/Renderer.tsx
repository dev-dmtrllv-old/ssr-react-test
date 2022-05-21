import { Request, Response } from "express";

export class Renderer
{
	private readonly component: () => string;
	private readonly req: any;
	private readonly res: Response<any, Record<string, any>>;

	constructor(component: () => string, req: Request, res: Response)
	{
		this.component = component;
		this.req = req;
		this.res = res;
	}

	public render()
	{
		return this.component();
	}
}

export type RendererType<T extends Renderer> = new (component: () => string, req: Request, res: Response) => T;
