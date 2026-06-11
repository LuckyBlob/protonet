"use client";

import { ReactElement, MouseEvent, useEffect, useRef, useState } from "react";

import * as UseClientDataState from "@/lib/use/useClientDataState";
import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";
import * as MessageData from "@/lib/gameplay/dynamicData/player/messageData";
import * as ClientRequestFunctions from "@/lib/networkRequests/client/clientRequestFunctions";
import * as HelperElements from "@/components/helperElements";

type MessagesViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

type SelectedMessageRowIdState = [number | null, (value: number | null) => void];
type DeletedMessageRowIdsState = [Set<number>, (value: Set<number>) => void];

type MessagesViewData =
{
    visibleMessageDatas: CoreType.MessageData[];
    selectedMessageRowIdState: SelectedMessageRowIdState;
    deletedMessageRowIdsState: DeletedMessageRowIdsState;
    psController: CoreType.PSController;
    pendingReselectionRef: { current: CoreType.MessagePreview | null };
};

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

function buildPredictedPreviewKey(messagePreview: CoreType.MessagePreview): string
{
    return `${messagePreview.receivedAt}|${messagePreview.title}`;
}

function collectPredictedPreviewKeys(messageDatas: CoreType.MessageData[]): Set<string>
{
    const keys: Set<string> = new Set<string>();
    for (const messageData of messageDatas)
    {
        if (messageData.messagePreview.messageRowId === -1)
        {
            keys.add(buildPredictedPreviewKey(messageData.messagePreview));
        }
    }

    return keys;
}
//#endregion

//#region state hooks
function useEntryRefresh(psController: CoreType.PSController): void
{
    useEffect((): void =>
    {
        const runRefresh = async (): Promise<void> =>
        {
            try
            {
                await ClientRequestFunctions.clientTryPlayerDataRequest(psController);
            }
            catch (error: unknown)
            {
                console.error("⚠️:", error);
            }
        };
        runRefresh();
    }, []);
}

function useDeselectOnNewPredicted(allMessageDatas: CoreType.MessageData[], selectedMessageRowIdState: SelectedMessageRowIdState): void
{
    const previousKeysRef: { current: Set<string> | null } = useRef<Set<string> | null>(null);

    useEffect((): void =>
    {
        const currentKeys: Set<string> = collectPredictedPreviewKeys(allMessageDatas);
        const previousKeys: Set<string> | null = previousKeysRef.current;
        previousKeysRef.current = currentKeys;

        if (previousKeys === null)
        {
            return;
        }

        let hasNewPredicted: boolean = false;
        for (const key of currentKeys)
        {
            if (previousKeys.has(key) === false)
            {
                hasNewPredicted = true;
                break;
            }
        }

        if (hasNewPredicted === true)
        {
            selectedMessageRowIdState[1](null);
        }
    }, [allMessageDatas]);
}

function useReselectAfterPredictedReconciles(
    allMessageDatas: CoreType.MessageData[],
    selectedMessageRowIdState: SelectedMessageRowIdState,
    pendingReselectionRef: { current: CoreType.MessagePreview | null },
): void
{
    useEffect((): void =>
    {
        const pending: CoreType.MessagePreview | null = pendingReselectionRef.current;
        if (pending === null)
        {
            return;
        }

        const replacement: CoreType.MessageData | undefined = allMessageDatas.find((messageData: CoreType.MessageData): boolean =>
        {
            return messageData.messagePreview.messageRowId !== -1
                && MessageData.doMessagePreviewsMatch(messageData.messagePreview, pending);
        });

        if (replacement === undefined)
        {
            return;
        }

        pendingReselectionRef.current = null;
        selectedMessageRowIdState[1](replacement.messagePreview.messageRowId);
    }, [allMessageDatas]);
}
//#endregion

//#region rendering helpers
function renderMessagePreviewRow(messageData: CoreType.MessageData, isSelected: boolean, onSelect: (messageData: CoreType.MessageData) => void, onDelete: (messageData: CoreType.MessageData) => void): ReactElement
{
    const messagePreview: CoreType.MessagePreview = messageData.messagePreview;
    const isUnread: boolean = messagePreview.isRead === 0;
    const messageRowId: number = messagePreview.messageRowId;

    const titleWeightClass: string = isUnread === true
        ? "font-bold"
        : "font-normal";
    const selectedClass: string = isSelected === true
        ? "bg-blue-700"
        : "hover:bg-white/10";

    const handleClick = (): void =>
    {
        onSelect(messageData);
    };

    const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>): void =>
    {
        e.stopPropagation();
        onDelete(messageData);
    };

    // A -1 id is not unique within the list, so use a stable composite when predicted.
    const reactKey: string = messageRowId === -1
        ? `predicted:${buildPredictedPreviewKey(messagePreview)}`
        : `real:${messageRowId}`;

    const element: ReactElement =
    (
        <div
            key={reactKey}
            onClick={handleClick}
            className={`flex flex-row items-center gap-2 px-3 py-2 border border-gray-600 rounded text-sm text-white text-left w-full cursor-pointer overflow-hidden shrink-0 ${selectedClass}`}
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

function renderMessageListSection(data: MessagesViewData): ReactElement
{
    if (data.visibleMessageDatas.length === 0)
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

    const handleSelect = (messageData: CoreType.MessageData): void =>
    {
        const messagePreview: CoreType.MessagePreview = messageData.messagePreview;
        const messageRowId: number = messagePreview.messageRowId;
        data.selectedMessageRowIdState[1](messageRowId);

        if (messageRowId === -1)
        {
            // Predicted message: mark-read with predicted fields. This both persists
            // is_read=1 server-side and returns refreshed playerData; the reselection
            // effect then swaps the selection over to the real id once it appears.
            data.pendingReselectionRef.current = messagePreview;
            const runMarkRead = async (): Promise<void> =>
            {
                const errorMessage: string | null = await ClientRequestFunctions.clientTryMarkMessageReadRequest(data.psController, -1, messagePreview);
                if (errorMessage !== null)
                {
                    console.error("⚠️:", `Mark predicted message read failed: ${errorMessage}`);
                    data.pendingReselectionRef.current = null;
                }
            };
            runMarkRead();
            return;
        }

        if (messagePreview.isRead === 1)
        {
            return;
        }

        const runMarkRead = async (): Promise<void> =>
        {
            const errorMessage: string | null = await ClientRequestFunctions.clientTryMarkMessageReadRequest(data.psController, messageRowId, null);
            if (errorMessage !== null)
            {
                console.error("⚠️:", `Mark message read failed for messageRowId ${messageRowId}: ${errorMessage}`);
            }
        };
        runMarkRead();
    };

    const handleDelete = (messageData: CoreType.MessageData): void =>
    {
        const messagePreview: CoreType.MessagePreview = messageData.messagePreview;
        const messageRowId: number = messagePreview.messageRowId;

        if (messageRowId !== -1)
        {
            const optimisticDeleted: Set<number> = new Set<number>(data.deletedMessageRowIdsState[0]);
            optimisticDeleted.add(messageRowId);
            data.deletedMessageRowIdsState[1](optimisticDeleted);
        }

        if (data.selectedMessageRowIdState[0] === messageRowId)
        {
            data.selectedMessageRowIdState[1](null);
        }

        const predictedPreview: CoreType.MessagePreview | null = messageRowId === -1 ? messagePreview : null;
        const runDelete = async (): Promise<void> =>
        {
            const errorMessage: string | null = await ClientRequestFunctions.clientTryDeleteMessageRequest(data.psController, messageRowId, predictedPreview);
            if (errorMessage !== null)
            {
                console.error("⚠️:", `Delete message ${messageRowId} failed: ${errorMessage}`);

                if (messageRowId !== -1)
                {
                    const revertedDeleted: Set<number> = new Set<number>(data.deletedMessageRowIdsState[0]);
                    revertedDeleted.delete(messageRowId);
                    data.deletedMessageRowIdsState[1](revertedDeleted);
                }
            }
        };
        runDelete();
    };

    const rowElements: ReactElement[] = data.visibleMessageDatas.map((messageData: CoreType.MessageData): ReactElement =>
    {
        const isSelected: boolean = data.selectedMessageRowIdState[0] === messageData.messagePreview.messageRowId;

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

function renderMessageBodyPlaceholder(): ReactElement
{
    const placeholderElement: ReactElement =
    (
        <div
            className="w-full border border-gray-600 rounded p-3 text-sm text-white overflow-y-auto"
            style={{ height: `${SECTION_HEIGHT_PX}px` }}
        />
    );

    return placeholderElement;
}

function renderMessageBodySection(data: MessagesViewData): ReactElement
{
    const selectedMessageRowId: number | null = data.selectedMessageRowIdState[0];
    if (selectedMessageRowId === null)
    {
        return renderMessageBodyPlaceholder();
    }

    const selectedMessageData: CoreType.MessageData | null = MessageData.findMessageDataByMessageRowId(data.visibleMessageDatas, selectedMessageRowId);
    if (selectedMessageData === null)
    {
        return renderMessageBodyPlaceholder();
    }

    const messageRow: DBType.MessageRow | null = selectedMessageData.messageRow;
    if (messageRow === null)
    {
        return renderMessageBodyPlaceholder();
    }

    const messagePreview: CoreType.MessagePreview = selectedMessageData.messagePreview;

    const element: ReactElement =
    (
        <div
            className="w-full border border-gray-600 rounded p-3 text-sm text-white overflow-y-auto flex flex-col gap-2"
            style={{ height: `${SECTION_HEIGHT_PX}px` }}
        >
            <div className="font-semibold">{messagePreview.title}</div>
            <div className="text-xs text-gray-400">{formatMessageTimestamp(messagePreview.receivedAt)}</div>
            <div className="whitespace-pre-wrap text-justify">{messageRow.body}</div>
        </div>
    );

    return element;
}

function renderMessagesViewLayout(data: MessagesViewData): ReactElement
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
                    {renderMessageListSection(data)}
                </div>

                <div
                    className="w-px bg-gray-400 shrink-0"
                    style={{ height: `${SECTION_HEIGHT_PX}px` }}
                />

                <div
                    className="px-3 shrink-0"
                    style={{ width: `${BODY_COLUMN_WIDTH_PX}px` }}
                >
                    {renderMessageBodySection(data)}
                </div>
            </div>
        </div>
    );

    return element;
}
//#endregion

export function MessagesView(props: MessagesViewProps): ReactElement
{
    const psController: CoreType.PSController = props.clientDataStateResult.psController;
    const selectedMessageRowIdState: SelectedMessageRowIdState = useState<number | null>(null);
    const deletedMessageRowIdsState: DeletedMessageRowIdsState = useState<Set<number>>(new Set<number>());
    const pendingReselectionRef: { current: CoreType.MessagePreview | null } = useRef<CoreType.MessagePreview | null>(null);

    const allMessageDatas: CoreType.MessageData[] = psController[0].predictedDBData.dynamicPlayerData.messageDatas;

    useEntryRefresh(psController);
    useDeselectOnNewPredicted(allMessageDatas, selectedMessageRowIdState);
    useReselectAfterPredictedReconciles(allMessageDatas, selectedMessageRowIdState, pendingReselectionRef);

    try
    {
        const visibleMessageDatas: CoreType.MessageData[] = MessageData.buildVisibleMessageDatas(allMessageDatas, deletedMessageRowIdsState[0]);

        const messagesViewData: MessagesViewData =
        {
            visibleMessageDatas: visibleMessageDatas,
            selectedMessageRowIdState: selectedMessageRowIdState,
            deletedMessageRowIdsState: deletedMessageRowIdsState,
            psController: psController,
            pendingReselectionRef: pendingReselectionRef,
        }

        return renderMessagesViewLayout(messagesViewData);
    }
    catch (error: unknown)
    {
        console.error("⚠️:", error);
        return <HelperElements.EmptyElement />;
    }
}
