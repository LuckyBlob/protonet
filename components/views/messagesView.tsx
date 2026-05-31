"use client";

import { ReactElement, useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as HelperElements from "@/components/helperElements";

type MessagesViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type SelectedMessageIndexState = [number | null, (value: number | null) => void];

const MAX_VISIBLE_MESSAGES: number = 50;
const VISIBLE_MESSAGE_ROW_COUNT: number = 5;
const MESSAGE_ROW_HEIGHT_PX: number = 56;

//#region pure helpers
export function computeUnreadMessageCount(messageDatas: CoreType.MessageData[]): number
{
    const unreadCount: number = messageDatas.filter((messageData: CoreType.MessageData): boolean =>
    {
        return messageData.messagePreview.isRead === false;
    }).length;

    return unreadCount;
}
//#endregion

//#region rendering helpers
function renderMessagePreviewRow(messageData: CoreType.MessageData, index: number, isSelected: boolean, onSelect: (index: number) => void): ReactElement
{
    const messagePreview: CoreType.MessagePreview = messageData.messagePreview;
    const isUnread: boolean = messagePreview.isRead === false;

    const unreadIndicator: ReactElement | null = isUnread === true
        ?
        (
            <span className="text-yellow-400 font-bold">●</span>
        )
        : null;

    const selectedClass: string = isSelected === true
        ? "bg-blue-700"
        : "hover:bg-white/10";

    const handleClick = (): void =>
    {
        onSelect(index);
    };

    const element: ReactElement =
    (
        <button
            key={index}
            onClick={handleClick}
            className={`flex flex-row items-center gap-2 px-3 py-2 border border-gray-600 rounded text-sm text-white text-left w-full ${selectedClass}`}
        >
            {unreadIndicator}
            <span className="font-semibold">Message type {messagePreview.type}</span>
        </button>
    );

    return element;
}

function renderMessageListSection(messageDatas: CoreType.MessageData[], selectedIndexState: SelectedMessageIndexState): ReactElement
{
    const cappedMessageDatas: CoreType.MessageData[] = messageDatas.slice(0, MAX_VISIBLE_MESSAGES);

    if (cappedMessageDatas.length === 0)
    {
        const emptyElement: ReactElement =
        (
            <div className="border border-gray-400 rounded px-6 py-3 text-sm text-center text-gray-400 w-full h-24 flex items-center justify-center">
                No messages.
            </div>
        );

        return emptyElement;
    }

    const handleSelect = (index: number): void =>
    {
        selectedIndexState[1](index);
    };

    const rowElements: ReactElement[] = cappedMessageDatas.map((messageData: CoreType.MessageData, index: number): ReactElement =>
    {
        const isSelected: boolean = selectedIndexState[0] === index;

        return renderMessagePreviewRow(messageData, index, isSelected, handleSelect);
    });

    const listMaxHeightPx: number = VISIBLE_MESSAGE_ROW_COUNT * MESSAGE_ROW_HEIGHT_PX;

    const element: ReactElement =
    (
        <div
            className="flex flex-col gap-2 overflow-y-auto pr-2 w-full"
            style={{ maxHeight: `${listMaxHeightPx}px` }}
        >
            {rowElements}
        </div>
    );

    return element;
}

function renderMessageBodySection(messageDatas: CoreType.MessageData[], selectedIndex: number | null): ReactElement | null
{
    if (selectedIndex === null)
    {
        return null;
    }

    const selectedMessageData: CoreType.MessageData | undefined = messageDatas[selectedIndex];

    if (selectedMessageData === undefined)
    {
        return null;
    }

    const messageRow: DBType.MessageRow = selectedMessageData.messageRow;

    const element: ReactElement =
    (
        <div className="flex flex-col gap-2 text-sm text-white w-full">
            <div className="font-semibold">Message type {messageRow.type}</div>
            <div className="whitespace-pre-wrap">{messageRow.body}</div>
        </div>
    );

    return element;
}

function renderMessagesViewLayout(props: MessagesViewProps, selectedIndexState: SelectedMessageIndexState): ReactElement
{
    const messageDatas: CoreType.MessageData[] = props.clientDataStateResult.psController[0].predictedDBData.dynamicPlayerData.messageDatas;
    const bodySection: ReactElement | null = renderMessageBodySection(messageDatas, selectedIndexState[0]);

    const element: ReactElement =
    (
        <div className="w-full flex flex-col items-center pt-4">
            <div className="flex flex-row items-start justify-center">
                <div className="flex flex-col items-stretch px-6 w-[320px]">
                    {renderMessageListSection(messageDatas, selectedIndexState)}
                </div>

                <div className="w-px bg-gray-400 h-80 my-0" />

                <div className="flex flex-col items-stretch px-6 w-[480px]">
                    {bodySection}
                </div>
            </div>
        </div>
    );

    return element;
}
//#endregion

export function MessagesView(props: MessagesViewProps): ReactElement
{
    const selectedIndexState: SelectedMessageIndexState = useState<number | null>(null);

    try
    {
        return renderMessagesViewLayout(props, selectedIndexState);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
