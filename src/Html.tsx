import React from "react";
import { SSRData } from "./SSRData";

const HtmlBase: React.FC<HtmlBaseProps> = ({ title, favicon = "data:;base64,iVBORw0KGgo=", scripts = [], styles = [], children, manifest }) =>
{
	return (
		<html>
			<head>
				<link rel="icon" href={favicon} />
				<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
				{manifest && <link rel="manifest" href={manifest} />}
				{title && <title>{title}</title>}
				{styles.map((href, i) => <link key={i} rel="stylesheet" href={href} />)}
			</head>
			<body>
				{children}
				{scripts.map((src, i) => <script key={i} src={src} />)}
			</body>
		</html>
	);
}

export const Html: React.FC<HtmlProps> = ({ appString, ssrData, ...props }) =>
{
	const ssrDataString = btoa(unescape(encodeURIComponent(JSON.stringify(ssrData))));
	
	return (
		<HtmlBase {...props}>
			<div id="root" dangerouslySetInnerHTML={{ __html: appString }}></div>
			<script id="__SSR_DATA__" dangerouslySetInnerHTML={{ __html: `document.getElementById("__SSR_DATA__").remove(); window.__SSR_DATA__ = \"${ssrDataString}\";` }}/>
		</HtmlBase>
	);
}

export const ErrorHtml = <P extends {}>({ error, ...props }: HtmlErrorProps<P>) =>
{
	return (
		<HtmlBase {...props as any}>
			<h1>{error.message}</h1>
			<h3>{error.message}</h3>
			{error.stack?.split("\n").map((s, i) => <span key={i}>{s}<br/></span>)}
		</HtmlBase>
	);
}

type HtmlBaseProps = {
	title?: string;
	favicon?: string;
	scripts?: string[];
	styles?: string[];
	children?: React.ReactNode;
	manifest?: string;
};

export type HtmlProps = {
	appString: string;
	ssrData: SSRData;
} & Omit<HtmlBaseProps, "children">;

export type HtmlErrorProps<P> = P & {
	error: Error;
} & Omit<HtmlBaseProps, "children">;
