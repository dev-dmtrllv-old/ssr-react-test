import React from "react";
import type { IonApp } from "../../IonApp";
export type { IonApp } from "../../IonApp";

export type IonAppComponent<T extends React.FC<any> = React.FC<any>> = IonApp.Component<T>;
