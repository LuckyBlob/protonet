"use client";

import { ReactElement, MouseEvent, useEffect, useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as HelperElements from "@/components/helperElements";

type MessagesViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type MessageBodyState =
{
    isLoading: boolean;
    body: string | null;
};

type SelectedCreatedAtState = [number | null, (value: number | null) => void];
type BodyState = [MessageBodyState, (value: MessageBodyState) => void];
type DeletedCreatedAtsState = [Set<number>, (value: Set<number>) => void];

const MAX_VISIBLE_MESSAGES: number = 50;
const VISIBLE_MESSAGE_ROW_COUNT: number = 5;
const MESSAGE_ROW_HEIGHT_PX: number = 48;
const MESSAGE_ROW_GAP_PX: number = 8;
const SECTION_HEIGHT_PX: number = (VISIBLE_MESSAGE_ROW_COUNT * MESSAGE_ROW_HEIGHT_PX) + ((VISIBLE_MESSAGE_ROW_COUNT - 1) * MESSAGE_ROW_GAP_PX);
const LAYOUT_WIDTH_PX: number = 720;
const SIMULATED_BODY_FETCH_DELAY_MS: number = 400;

//#region pure helpers
export function computeUnreadMessageCount(messageDatas: CoreType.MessageData[]): number
{
    const unreadCount: number = messageDatas.filter((messageData: CoreType.MessageData): boolean =>
    {
        return messageData.messagePreview.isRead === false;
    }).length;

    return unreadCount;
}

function buildVisibleMessageDatas(messageDatas: CoreType.MessageData[], deletedCreatedAts: Set<number>): CoreType.MessageData[]
{
    const filteredMessageDatas: CoreType.MessageData[] = messageDatas.filter((messageData: CoreType.MessageData): boolean =>
    {
        return deletedCreatedAts.has(messageData.messagePreview.createdAt) === false;
    });

    const sortedMessageDatas: CoreType.MessageData[] = [...filteredMessageDatas].sort((a: CoreType.MessageData, b: CoreType.MessageData): number =>
    {
        return b.messagePreview.createdAt - a.messagePreview.createdAt;
    });

    const cappedMessageDatas: CoreType.MessageData[] = sortedMessageDatas.slice(0, MAX_VISIBLE_MESSAGES);

    return cappedMessageDatas;
}

function findMessageDataByCreatedAt(messageDatas: CoreType.MessageData[], createdAt: number): CoreType.MessageData | null
{
    const matchingMessageData: CoreType.MessageData | undefined = messageDatas.find((messageData: CoreType.MessageData): boolean =>
    {
        return messageData.messagePreview.createdAt === createdAt;
    });

    if (matchingMessageData === undefined)
    {
        return null;
    }

    return matchingMessageData;
}

function formatMessageTimestamp(createdAt: number): string
{
    const date: Date = new Date(createdAt);
    return date.toLocaleString();
}
//#endregion

//#region state hooks
function useMessageBodyState(messageDatas: CoreType.MessageData[], selectedCreatedAt: number | null): MessageBodyState
{
    const bodyState: BodyState = useState<MessageBodyState>({ isLoading: false, body: null });

    useEffect((): (() => void) | void =>
    {
        if (selectedCreatedAt === null)
        {
            bodyState[1]({ isLoading: false, body: null });
            return;
        }

        const selectedMessageData: CoreType.MessageData | null = findMessageDataByCreatedAt(messageDatas, selectedCreatedAt);
        if (selectedMessageData === null)
        {
            bodyState[1]({ isLoading: false, body: null });
            return;
        }

        bodyState[1]({ isLoading: true, body: null });

        const bodyToLoad: string = selectedMessageData.messageRow.body;
        const timeoutId: ReturnType<typeof setTimeout> = setTimeout((): void =>
        {
            bodyState[1]({ isLoading: false, body: bodyToLoad });
        }, SIMULATED_BODY_FETCH_DELAY_MS);

        return (): void =>
        {
            clearTimeout(timeoutId);
        };
    }, [selectedCreatedAt]);

    return bodyState[0];
}
//#endregion

//#region rendering helpers
function renderMessagePreviewRow(messageData: CoreType.MessageData, isSelected: boolean, onSelect: (createdAt: number) => void, onDelete: (createdAt: number) => void): ReactElement
{
    const messagePreview: CoreType.MessagePreview = messageData.messagePreview;
    const isUnread: boolean = messagePreview.isRead === false;
    const createdAt: number = messagePreview.createdAt;

    const titleWeightClass: string = isUnread === true
        ? "font-bold"
        : "font-normal";
    const selectedClass: string = isSelected === true
        ? "bg-blue-700"
        : "hover:bg-white/10";

    const handleClick = (): void =>
    {
        onSelect(createdAt);
    };

    const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>): void =>
    {
        e.stopPropagation();
        onDelete(createdAt);
    };

    const element: ReactElement =
    (
        <div
            key={createdAt}
            onClick={handleClick}
            className={`flex flex-row items-center gap-2 px-3 py-2 border border-gray-600 rounded text-sm text-white text-left w-full cursor-pointer ${selectedClass}`}
            style={{ height: `${MESSAGE_ROW_HEIGHT_PX}px` }}
        >
            <span className={`flex-1 truncate ${titleWeightClass}`}>{messagePreview.title}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatMessageTimestamp(createdAt)}</span>
            <button
                type="button"
                onClick={handleDeleteClick}
                aria-label="Delete message"
                className="text-gray-300 hover:text-red-400 px-2 font-bold"
            >
                ✕
            </button>
        </div>
    );

    return element;
}

function renderMessageListSection(messageDatas: CoreType.MessageData[], selectedCreatedAtState: SelectedCreatedAtState, deletedCreatedAtsState: DeletedCreatedAtsState): ReactElement
{
    if (messageDatas.length === 0)
    {
        const emptyElement: ReactElement =
        (
            <div
                className="border border-gray-400 rounded px-6 py-3 text-sm text-center text-gray-400 w-full flex items-center justify-center"
                style={{ height: `${SECTION_HEIGHT_PX}px` }}
            >
                No messages.
            </div>
        );

        return emptyElement;
    }

    const handleSelect = (createdAt: number): void =>
    {
        selectedCreatedAtState[1](createdAt);
    };

    const handleDelete = (createdAt: number): void =>
    {
        const updatedDeleted: Set<number> = new Set<number>(deletedCreatedAtsState[0]);
        updatedDeleted.add(createdAt);
        deletedCreatedAtsState[1](updatedDeleted);

        if (selectedCreatedAtState[0] === createdAt)
        {
            selectedCreatedAtState[1](null);
        }
    };

    const rowElements: ReactElement[] = messageDatas.map((messageData: CoreType.MessageData): ReactElement =>
    {
        const isSelected: boolean = selectedCreatedAtState[0] === messageData.messagePreview.createdAt;

        return renderMessagePreviewRow(messageData, isSelected, handleSelect, handleDelete);
    });

    const element: ReactElement =
    (
        <div
            className="flex flex-col overflow-y-auto pr-2 w-full"
            style={{ height: `${SECTION_HEIGHT_PX}px`, gap: `${MESSAGE_ROW_GAP_PX}px` }}
        >
            {rowElements}
        </div>
    );

    return element;
}

function renderMessageBodySection(messageDatas: CoreType.MessageData[], selectedCreatedAt: number | null, bodyState: MessageBodyState): ReactElement
{
    const containerClass: string = "w-full border border-gray-600 rounded p-3 text-sm text-white overflow-y-auto";
    const containerStyle: { height: string } = { height: `${SECTION_HEIGHT_PX}px` };

    if (selectedCreatedAt === null)
    {
        const placeholderElement: ReactElement =
        (
            <div className={containerClass} style={containerStyle} />
        );

        return placeholderElement;
    }

    if (bodyState.isLoading === true)
    {
        const loadingElement: ReactElement =
        (
            <div
                className={`${containerClass} flex items-center justify-center text-gray-400`}
                style={containerStyle}
            >
                Loading message…
            </div>
        );

        return loadingElement;
    }

    const selectedMessageData: CoreType.MessageData | null = findMessageDataByCreatedAt(messageDatas, selectedCreatedAt);
    if (selectedMessageData === null || bodyState.body === null)
    {
        const missingElement: ReactElement =
        (
            <div className={containerClass} style={containerStyle} />
        );

        return missingElement;
    }

    const messagePreview: CoreType.MessagePreview = selectedMessageData.messagePreview;

    const element: ReactElement =
    (
        <div className={`${containerClass} flex flex-col gap-2`} style={containerStyle}>
            <div className="font-semibold">{messagePreview.title}</div>
            <div className="text-xs text-gray-400">{formatMessageTimestamp(messagePreview.createdAt)}</div>
            <div className="whitespace-pre-wrap">{bodyState.body}</div>
        </div>
    );

    return element;
}

function renderMessagesViewLayout(visibleMessageDatas: CoreType.MessageData[], selectedCreatedAtState: SelectedCreatedAtState, deletedCreatedAtsState: DeletedCreatedAtsState, bodyState: MessageBodyState): ReactElement
{
    const element: ReactElement =
    (
        <div className="w-full flex justify-center pt-4">
            <div
                className="flex flex-row items-start"
                style={{ width: `${LAYOUT_WIDTH_PX}px`, maxWidth: "100%" }}
            >
                <div className="w-1/3 px-3">
                    {renderMessageListSection(visibleMessageDatas, selectedCreatedAtState, deletedCreatedAtsState)}
                </div>

                <div
                    className="w-px bg-gray-400"
                    style={{ height: `${SECTION_HEIGHT_PX}px` }}
                />

                <div className="w-2/3 px-3">
                    {renderMessageBodySection(visibleMessageDatas, selectedCreatedAtState[0], bodyState)}
                </div>
            </div>
        </div>
    );

    return element;
}
//#endregion

export function MessagesView(props: MessagesViewProps): ReactElement
{
    const selectedCreatedAtState: SelectedCreatedAtState = useState<number | null>(null);
    const deletedCreatedAtsState: DeletedCreatedAtsState = useState<Set<number>>(new Set<number>());

    const allMessageDatas: CoreType.MessageData[] = props.clientDataStateResult.psController[0].predictedDBData.dynamicPlayerData.messageDatas;
    const visibleMessageDatas: CoreType.MessageData[] = buildVisibleMessageDatas(allMessageDatas, deletedCreatedAtsState[0]);
    const bodyState: MessageBodyState = useMessageBodyState(visibleMessageDatas, selectedCreatedAtState[0]);

    try
    {
        return renderMessagesViewLayout(visibleMessageDatas, selectedCreatedAtState, deletedCreatedAtsState, bodyState);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
