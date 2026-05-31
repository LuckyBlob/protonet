"use client";

import { ReactElement, MouseEvent, useEffect, useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/gameplayData/dynamic/messageData";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as APIEndPoint from "@/app/api/apiEndPoints";
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

type SelectedMessageRowIdState = [number | null, (value: number | null) => void];
type BodyState = [MessageBodyState, (value: MessageBodyState) => void];
type DeletedMessageRowIdsState = [Set<number>, (value: Set<number>) => void];

const MESSAGE_ROW_HEIGHT_PX: number = 48;
const MESSAGE_ROW_GAP_PX: number = 8;
const SECTION_HEIGHT_PX: number = (MessageData.VISIBLE_MESSAGE_ROW_COUNT * MESSAGE_ROW_HEIGHT_PX) + ((MessageData.VISIBLE_MESSAGE_ROW_COUNT - 1) * MESSAGE_ROW_GAP_PX);
const LAYOUT_WIDTH_PX: number = 720;
const LIST_COLUMN_WIDTH_PX: number = Math.floor(LAYOUT_WIDTH_PX / 3);
const BODY_COLUMN_WIDTH_PX: number = LAYOUT_WIDTH_PX - LIST_COLUMN_WIDTH_PX;

//#region pure helpers
function formatMessageTimestamp(epochMs: number): string
{
    const date: Date = new Date(epochMs);
    return date.toLocaleString();
}
//#endregion

//#region state hooks
function useMessageBodyState(selectedMessageRowId: number | null): MessageBodyState
{
    const bodyState: BodyState = useState<MessageBodyState>({ isLoading: false, body: null });

    useEffect((): void =>
    {
        if (selectedMessageRowId === null)
        {
            bodyState[1]({ isLoading: false, body: null });
            return;
        }

        bodyState[1]({ isLoading: true, body: null });

        let isCancelled: boolean = false;
        const runFetch = async (): Promise<void> =>
        {
            const response: APIEndPoint.ResponseForData<typeof APIEndPoint.DataRequest.Message> | null = await ClientRequestFunctions.clientTryMessageRequest(selectedMessageRowId);
            if (isCancelled === true)
            {
                return;
            }

            // Use != instead of !== here to catch everything that's very weird.
            if (response === null || response.error != null || response.messageRow == null)
            {
                console.error("⚠️:", `Failed to fetch messageRowId ${selectedMessageRowId}.`);
                bodyState[1]({ isLoading: false, body: null });
                return;
            }

            const messageRow: DBType.MessageRow = response.messageRow;
            bodyState[1]({ isLoading: false, body: messageRow.body });
        };
        runFetch();

        // Cancel-on-unmount / selection-change guard via closure flag instead of returning a cleanup.
        // We don't have a real abort signal yet; this prevents stale fetches from clobbering the latest selection.
        return ((): void => { isCancelled = true; }) as unknown as void;
    }, [selectedMessageRowId]);

    return bodyState[0];
}
//#endregion

//#region rendering helpers
function renderMessagePreviewRow(messageData: CoreType.MessageData, isSelected: boolean, onSelect: (messageRowId: number) => void, onDelete: (messageRowId: number) => void): ReactElement
{
    const messagePreview: CoreType.MessagePreview = messageData.messagePreview;
    const isUnread: boolean = messagePreview.isRead === false;
    const messageRowId: number = messagePreview.messageRowId;

    const titleWeightClass: string = isUnread === true
        ? "font-bold"
        : "font-normal";
    const selectedClass: string = isSelected === true
        ? "bg-blue-700"
        : "hover:bg-white/10";

    const handleClick = (): void =>
    {
        onSelect(messageRowId);
    };

    const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>): void =>
    {
        e.stopPropagation();
        onDelete(messageRowId);
    };

    const element: ReactElement =
    (
        <div
            key={messageRowId}
            onClick={handleClick}
            className={`flex flex-row items-center gap-2 px-3 py-2 border border-gray-600 rounded text-sm text-white text-left w-full cursor-pointer overflow-hidden ${selectedClass}`}
            style={{ height: `${MESSAGE_ROW_HEIGHT_PX}px` }}
        >
            <span className={`flex-1 min-w-0 truncate ${titleWeightClass}`}>{messagePreview.title}</span>
            <button
                type="button"
                onClick={handleDeleteClick}
                aria-label="Delete message"
                className="text-gray-300 hover:text-red-400 px-2 font-bold shrink-0"
            >
                ✕
            </button>
        </div>
    );

    return element;
}

function renderMessageListSection(messageDatas: CoreType.MessageData[], selectedMessageRowIdState: SelectedMessageRowIdState, deletedMessageRowIdsState: DeletedMessageRowIdsState, psController: CoreType.PSController): ReactElement
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

    const handleSelect = (messageRowId: number): void =>
    {
        selectedMessageRowIdState[1](messageRowId);
    };

    const handleDelete = (messageRowId: number): void =>
    {
        const optimisticDeleted: Set<number> = new Set<number>(deletedMessageRowIdsState[0]);
        optimisticDeleted.add(messageRowId);
        deletedMessageRowIdsState[1](optimisticDeleted);

        if (selectedMessageRowIdState[0] === messageRowId)
        {
            selectedMessageRowIdState[1](null);
        }

        const runDelete = async (): Promise<void> =>
        {
            const errorMessage: string | null = await ClientRequestFunctions.clientTryDeleteMessageRequest(psController, messageRowId);
            if (errorMessage !== null)
            {
                console.error("⚠️:", `Delete message ${messageRowId} failed: ${errorMessage}`);
                const revertedDeleted: Set<number> = new Set<number>(deletedMessageRowIdsState[0]);
                revertedDeleted.delete(messageRowId);
                deletedMessageRowIdsState[1](revertedDeleted);
            }
        };
        runDelete();
    };

    const rowElements: ReactElement[] = messageDatas.map((messageData: CoreType.MessageData): ReactElement =>
    {
        const isSelected: boolean = selectedMessageRowIdState[0] === messageData.messagePreview.messageRowId;

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

function renderMessageBodySection(messageDatas: CoreType.MessageData[], selectedMessageRowId: number | null, bodyState: MessageBodyState): ReactElement
{
    const containerClass: string = "w-full border border-gray-600 rounded p-3 text-sm text-white overflow-y-auto";
    const containerStyle: { height: string } = { height: `${SECTION_HEIGHT_PX}px` };

    if (selectedMessageRowId === null)
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

    if (bodyState.body === null)
    {
        const missingElement: ReactElement =
        (
            <div
                className={`${containerClass} flex items-center justify-center text-gray-400`}
                style={containerStyle}
            >
                Could not load message.
            </div>
        );

        return missingElement;
    }

    const selectedMessageData: CoreType.MessageData | null = MessageData.findMessageDataByMessageRowId(messageDatas, selectedMessageRowId);
    const titleText: string = selectedMessageData !== null ? selectedMessageData.messagePreview.title : "";
    const receivedAt: number | null = selectedMessageData !== null ? selectedMessageData.messagePreview.receivedAt : null;

    const element: ReactElement =
    (
        <div className={`${containerClass} flex flex-col gap-2`} style={containerStyle}>
            <div className="font-semibold">{titleText}</div>
            {receivedAt !== null ? <div className="text-xs text-gray-400">{formatMessageTimestamp(receivedAt)}</div> : null}
            <div className="whitespace-pre-wrap text-justify">{bodyState.body}</div>
        </div>
    );

    return element;
}

function renderMessagesViewLayout(visibleMessageDatas: CoreType.MessageData[], selectedMessageRowIdState: SelectedMessageRowIdState, deletedMessageRowIdsState: DeletedMessageRowIdsState, bodyState: MessageBodyState, psController: CoreType.PSController): ReactElement
{
    const element: ReactElement =
    (
        <div className="w-full flex flex-row justify-start pt-4 pl-8">
            <div
                className="flex flex-row items-start shrink-0"
                style={{ width: `${LAYOUT_WIDTH_PX}px` }}
            >
                <div
                    className="px-3 shrink-0"
                    style={{ width: `${LIST_COLUMN_WIDTH_PX}px` }}
                >
                    {renderMessageListSection(visibleMessageDatas, selectedMessageRowIdState, deletedMessageRowIdsState, psController)}
                </div>

                <div
                    className="w-px bg-gray-400 shrink-0"
                    style={{ height: `${SECTION_HEIGHT_PX}px` }}
                />

                <div
                    className="px-3 shrink-0"
                    style={{ width: `${BODY_COLUMN_WIDTH_PX}px` }}
                >
                    {renderMessageBodySection(visibleMessageDatas, selectedMessageRowIdState[0], bodyState)}
                </div>
            </div>
        </div>
    );

    return element;
}
//#endregion

export function MessagesView(props: MessagesViewProps): ReactElement
{
    const selectedMessageRowIdState: SelectedMessageRowIdState = useState<number | null>(null);
    const deletedMessageRowIdsState: DeletedMessageRowIdsState = useState<Set<number>>(new Set<number>());

    const allMessageDatas: CoreType.MessageData[] = props.clientDataStateResult.psController[0].predictedDBData.dynamicPlayerData.messageDatas;
    const visibleMessageDatas: CoreType.MessageData[] = MessageData.buildVisibleMessageDatas(allMessageDatas, deletedMessageRowIdsState[0]);
    const bodyState: MessageBodyState = useMessageBodyState(selectedMessageRowIdState[0]);

    try
    {
        return renderMessagesViewLayout(visibleMessageDatas, selectedMessageRowIdState, deletedMessageRowIdsState, bodyState, props.clientDataStateResult.psController);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
