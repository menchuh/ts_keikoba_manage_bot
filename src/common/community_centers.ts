import { CommunityCenter, CommunityCenterConfig } from './type'

export const communityCenters: CommunityCenterConfig = {
    '中央区': [
        {
            'name': '京橋区民館',
            'address': '東京都中央区京橋2丁目6-7',
            'image': 'images/tokyo-chuoku/kyobashi_meijiza.jpg',
        },
        {
            'name': '京橋プラザ区民館',
            'address': '東京都中央区銀座1-25-3',
            'image': 'images/tokyo-chuoku/kyobashiplaza_kyobashikoen.png',
        },
        {
            'name': '銀座区民館',
            'address': '東京都中央区銀座4丁目13-17',
            'image': 'images/tokyo-chuoku/ginza_kabukiza.png',
        },
        {
            'name': '新富区民館',
            'address': '東京都中央区新富1丁目13-24',
            'image': 'images/tokyo-chuoku/shintomi_shintomibashi.jpeg',
        },
        {
            'name': '明石町区民館',
            'address': '東京都中央区明石町14番2号',
            'image': 'images/tokyo-chuoku/akashicho_seiroka.jpg',
        },
        {
            'name': '八丁堀区民館',
            'address': '東京都中央区八丁堀4丁目13-12',
            'image': 'images/tokyo-chuoku/hacchobori_sakuragawapark.jpeg',
        },
        {
            'name': '新川区民館',
            'address': '東京都中央区新川1丁目26-1',
            'image': 'images/tokyo-chuoku/shinkawa_shinkawa.jpeg',
        },
        {
            'name': '堀留町区民館',
            'address': '東京都中央区日本橋堀留町1丁目1-1',
            'image': 'images/tokyo-chuoku/horidomecho_suginomorishrine.jpeg',
        },
        {
            'name': '人形町区民館',
            'address': '東京都中央区日本橋人形町2丁目14-5',
            'image': 'images/tokyo-chuoku/ningyocho_ningyocho.jpeg',
        },
        {
            'name': '久松町区民館',
            'address': '東京都中央区日本橋久松町1-2',
            'image': 'hisamatsucho_kodomopark.jpeg',
        },
        {
            'name': '浜町区民館',
            'address': '東京都中央区日本橋浜町3丁目37-1',
            'image': 'images/tokyo-chuoku/hamacho_hamachopark.jpeg',
        },
        {
            'name': '新馬橋区民館',
            'address': '東京都中央区日本橋兜町11-9',
            'image': 'images/tokyo-chuoku/shimbabashi_kabutocho.jpeg',
        },
        {
            'name': '佃区民館',
            'address': '東京都中央区佃2丁目17-8',
            'image': 'images/tokyo-chuoku/tsukuda_tsukudaoohashi.jpeg',
        },
        {
            'name': '月島区民館',
            'address': '東京都中央区月島2丁目8-11',
            'image': 'images/tokyo-chuoku/tsukishima_monjastreet.jpeg',
        },
        {
            'name': '勝どき区民館',
            'address': '東京都中央区勝どき1丁目5-1 勝どき1丁目アパート1号棟',
            'image': 'images/tokyo-chuoku/kyobashi_meijiza.jpg',
        },
        {
            'name': '豊海区民館',
            'address': '東京都中央区勝どき6丁目7',
            'image': 'images/tokyo-chuoku/toyomi_toyomiundokoen.jpeg',
        },
        {
            'name': '晴海区民館',
            'address': '東京都中央区晴海1丁目8-6',
            'image': 'images/tokyo-chuoku/harumi_terminal.jpeg',
        },
        {
            'name': '中央区立産業会館',
            'address': '東京都中央区東日本橋2-22-4',
            'image': 'images/tokyo-chuoku/sangyo_sangyokaikan.jpeg',
        },
    ],
}

/**
 * 地域名と施設名から指定された施設情報を返す関数
 * @param area 地域名（市区町村）
 * @param name 施設名
 * @returns
 */
export const getCommunityCenterByAreaAndName = (
    area: string,
    name: string
): CommunityCenter | undefined => {
    const communityCentersOfArea = communityCenters[area]
    const communityCenter = communityCentersOfArea.find((c) => c.name === name)
    return communityCenter
}
