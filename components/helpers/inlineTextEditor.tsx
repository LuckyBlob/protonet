"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { ReactElement } from "react";

type InlineTextEditorProps =
{
    label: string;
    initialValue: string;
    placeholder: string;
    saveLabel: string;
    inputType: string;
    maxLength?: number;
    min?: number;
    onSave: (value: string) => void;
};

export function InlineTextEditor(props: InlineTextEditorProps): ReactElement
{
    const valueState: [string, (value: string) => void] = useState<string>(props.initialValue);
    const setValue: (value: string) => void = valueState[1];

    useEffect((): void =>
    {
        setValue(props.initialValue);
    }, [props.initialValue]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void =>
    {
        setValue(event.target.value);
    };

    const handleSave = (): void =>
    {
        props.onSave(valueState[0]);
    };

    const element: ReactElement =
    (
        <div className="flex flex-row items-center gap-2">
            <span className="text-sm text-white">{props.label}</span>
            <input
                type={props.inputType}
                value={valueState[0]}
                maxLength={props.maxLength}
                min={props.min}
                placeholder={props.placeholder}
                onChange={handleChange}
                className="border border-gray-400 px-2 py-1 rounded bg-white text-black"
            />
            <button
                onClick={handleSave}
                className="px-4 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
                {props.saveLabel}
            </button>
        </div>
    );

    return element;
}
