/* eslint no-unused-vars: 0 */
export enum UserMode {
    JoinGroup = 'JoinGroup',
    ListPractices = 'ListPractices',
    NotifyPractices = 'NotifyPractices',
    AddPractice = 'AddPractice',
    DeletePractice = 'DeletePractice',
    WithdrawGroup = 'WithdrawGroup',
}

export enum UserNotifyPracticesWithdrawGroupPhase {
    AskGroup = 'AskGroup',
    Confirm = 'Confirm',
}

export enum UserAddPracticePhase {
    AskGroup = 'AskGroup',
    AskPlace = 'AskPlace',
    AskDate = 'AskDate',
    AskStart = 'AskStart',
    AskEnd = 'AskEnd',
}
