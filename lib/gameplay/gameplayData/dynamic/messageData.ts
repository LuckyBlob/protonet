import * as CoreType from "@/lib/gameplay/coreData/type/coreTypes";

//#region base vars
export const MAX_VISIBLE_MESSAGES: number = 50;
export const VISIBLE_MESSAGE_ROW_COUNT: number = 5;
export const SIMULATED_BODY_FETCH_DELAY_MS: number = 400;
//#endregion

//#region message helpers
export function computeUnreadMessageCount(messageDatas: CoreType.MessageData[]): number
{
    const unreadCount: number = messageDatas.filter((messageData: CoreType.MessageData): boolean =>
    {
        return messageData.messagePreview.isRead === false;
    }).length;

    return unreadCount;
}

export function buildVisibleMessageDatas(messageDatas: CoreType.MessageData[], deletedCreatedAts: Set<number>): CoreType.MessageData[]
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

export function findMessageDataByCreatedAt(messageDatas: CoreType.MessageData[], createdAt: number): CoreType.MessageData | null
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
//#endregion
