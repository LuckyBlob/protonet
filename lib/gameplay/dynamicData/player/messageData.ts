import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

//#region base vars
export const MAX_VISIBLE_MESSAGES: number = 50;
export const VISIBLE_MESSAGE_ROW_COUNT: number = 5;
//#endregion

export type MessageType = typeof MessageType[keyof typeof MessageType];
export const MessageType =
{
    Admin: 1,
    FleetAction: 2,
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
//#endregion
