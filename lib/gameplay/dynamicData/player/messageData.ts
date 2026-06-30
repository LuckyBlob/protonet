import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";
import * as DBType from "@/lib/db/dbTypes";

//#region base vars
export const MAX_VISIBLE_MESSAGES: number = 50;
export const VISIBLE_MESSAGE_ROW_COUNT: number = 5;
//#endregion

export type MessageType = typeof MessageType[keyof typeof MessageType];
export const MessageType =
{
    Admin: 1,
    FleetAction: 2,
    Espionage: 3,
    Scan: 4,
    MissileReport: 5,
} as const;

//#region message helpers
export function computeUnreadMessageCount(messageDatas: CoreType.MessageData[]): number
{
    const unreadCount: number = messageDatas.filter((messageData: CoreType.MessageData): boolean =>
    {
        return messageData.messagePreview.isRead === 0;
    }).length;

    return unreadCount;
}

export function buildVisibleMessageDatas(messageDatas: CoreType.MessageData[], deletedMessageRowIds: Set<number>): CoreType.MessageData[]
{
    const filteredMessageDatas: CoreType.MessageData[] = messageDatas.filter((messageData: CoreType.MessageData): boolean =>
    {
        return deletedMessageRowIds.has(messageData.messagePreview.messageRowId) === false;
    });

    const sortedMessageDatas: CoreType.MessageData[] = [...filteredMessageDatas].sort((a: CoreType.MessageData, b: CoreType.MessageData): number =>
    {
        return b.messagePreview.receivedAt - a.messagePreview.receivedAt;
    });

    const cappedMessageDatas: CoreType.MessageData[] = sortedMessageDatas.slice(0, MAX_VISIBLE_MESSAGES);

    return cappedMessageDatas;
}

// Identifies whether two previews refer to the same logical message. Used to reconcile
// a predicted (id === -1) entry with its persisted counterpart from the server, where
// the real id is not yet known on the client. Two previews with identical identifying
// fields are mathematically interchangeable for this purpose.
// SINGLE SOURCE OF TRUTH for the set of identifying fields — add any new field here
// and mirror it into the corresponding WHERE clauses in
// serverRequestFunctions.serverMarkMessageReadByPredictedFields and
// serverRequestFunctions.serverDeleteMessageRowByPredictedFields.
export function doMessagePreviewsMatch(a: CoreType.MessagePreview, b: CoreType.MessagePreview): boolean
{
    return a.receivedAt === b.receivedAt && a.title === b.title;
}

export function findMessageDataByMessageRowId(messageDatas: CoreType.MessageData[], messageRowId: number): CoreType.MessageData | null
{
    const matchingMessageData: CoreType.MessageData | undefined = messageDatas.find((messageData: CoreType.MessageData): boolean =>
    {
        return messageData.messagePreview.messageRowId === messageRowId;
    });

    if (matchingMessageData === undefined)
    {
        return null;
    }

    return matchingMessageData;
}

export function addMessageRowToPlayerData(playerData: CoreType.PlayerData, messageRow: DBType.MessageRow | null): void
{
    if (messageRow === null)
    {
        return;
    }

    const newMessagePreview: CoreType.MessagePreview =
    {
        messageRowId: messageRow.id,
        receivedAt: messageRow.received_at,
        title: messageRow.title,
        isRead: messageRow.is_read,
        type: messageRow.type,
    };
    const newMessageData: CoreType.MessageData =
    {
        messagePreview: newMessagePreview,
        messageRow: messageRow,
    };
    playerData.dynamicPlayerData.messageDatas.push(newMessageData);
}
//#endregion
