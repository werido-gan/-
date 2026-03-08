import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LogisticsUtilService {
  // 快递公司名称到代码的映射
  private readonly carrierCodeMap: Record<string, string> = {
    '顺丰': 'shunfeng',
    '申通': 'shentong',
    '圆通': 'yuantong',
    '韵达': 'yunda',
    '韵达快运': 'ydky',
    '韵达全': 'ydquan',
    '中通': 'zhongtong',
    '中通快运': 'zhongtongkuaiyun',
    '中通国际': 'ztog',
    '中通冷链': 'ztocc',
    '中通非缓存': 'ztonocache',
    '极兔': 'jito',
    'EMS': 'ems',
    'EMS经济': 'eyb',
    'EMS英文': 'emsen',
    'EMS非缓存': 'emsnocache',
    '邮政国内小包': 'youzhengguonei',
    '邮政国际': 'youzhengguoji',
    '邮速达': 'inpostysd',
    '京东': 'jd',
    '京东高速查': 'jdgao',
    '京东验手机': 'jdbyphone',
    '京东全': 'jdquan',
    '京东前半程': 'jdqian',
    '百世': 'huitongkuaidi',
    '百世快运': 'baishiwuliu',
    '德邦': 'debangwuliu',
    '跨越': 'kuayue',
    '安能': 'annengwuliu',
    '安能快递': 'ane66',
    '安得': 'annto',
    '安迅': 'anxl',
    '安顺快运': 'anshun',
    '安敏': 'anmin56',
    '宅急送': 'zhaijisong',
    '全峰': 'quanfengkuaidi',
    '优速': 'youshuwuliu',
    '如风达': 'rufengda',
    '国通': 'guotongkuaidi',
    '加运美': 'jiayunmeiwuliu',
    '速尔': 'suer',
    '远成': 'yuanchengwuliu',
    '远成快运': 'ycgky',
    'UEQ': 'ueq',
    '菜鸟': 'zhimakaimen',
    '菜鸟农村': 'cnnc',
    '菜鸟大件': 'cndj',
    '全一': 'quanyikuaidi',
    '龙邦': 'longbanwuliu',
    '信丰': 'xinfengwuliu',
    '苏宁': 'suning',
    '佳吉': 'jiajiwuliu',
    'D速': 'dsukuaidi',
    '亚风': 'yafengsudi',
    '中铁快运': 'zhongtiekuaiyun',
    '天地华宇': 'tiandihuayu',
    '丰程': 'sccod',
    '晟邦': 'nanjingshengbang',
    '递四方': 'disifang',
    '蓝天国际': 'blueskyexpress',
    '程光': 'flyway',
    '富腾达': 'ftd',
    '转运四方': 'zhuanyunsifang',
    '澳世': 'ausexpress',
    'AOL澳通': 'aolau',
    '澳邮中国快运': 'auexpress',
    'FedEx': 'fedex',
    'FedEx中文': 'fedexcn',
    'UPS': 'ups',
    '品骏': 'pjbest',
    '长江国际': 'changjiang',
    '斑马物流': 'banma',
    '捷安达': 'jieanda',
    'C＆C': 'cncexp',
    '极地': 'polarexpress',
    '全速快运': 'quansu',
    '优优': 'youyou',
    '自动识别': 'auto',
    '黄马甲': 'huangmajia',
    '东骏': 'dongjun',
    '增益': 'zengyisudi',
    '快服务': 'kfwnet',
    '日日顺': 'rrs',
    '新邦': 'xinbangwuliu',
    '运通': 'yuntongkuaidi',
    'KJDE': 'kjde',
    'EWE': 'ewe',
    '大田': 'datianwuliu',
    '易客满': 'ecmscn',
    '联昊通': 'lianhaowuliu',
    '南方传媒': 'ndwl',
    'DHL中国': 'dhl',
    'DHL国际': 'dhlen',
    'USPS': 'usps',
    '嘉里大通': 'jialidatong',
    '黑猫宅急便': 'yct',
    '原飞航': 'yfh',
    '特急送': 'lntjs',
    '华企快运': 'huaqikuaiyun',
    '速通': 'sut56',
    '京广': 'jinguangsudikuaijian',
    '盛辉': 'shenghuiwuliu',
    '香港环球快运': 'huanqiuabc',
    '远航国际': 'yuanhhk',
    '平安达腾飞': 'pingandatengfei',
    '顺心捷达': 'sxjdfreight',
    '上海同城快递': 'shpost',
    '九曳': 'jiuyescm',
    '优邦': 'ubonex',
    '澳洲飞跃': 'rlgaus',
    '山西建华': 'sxjh',
    '春风': 'spring56',
    '新配盟': 'zmkmkd',
    '迅达': 'xdexpress',
    '陆本': 'luben',
    '日昱': 'riyuwuliu',
    '欧亚专线': 'euasia',
    '澳德': 'auod',
    '商桥': 'shangqiao56',
    'TNT': 'tnt',
    '尚途国际': 'shangtu',
    '中环': 'zhonghuan',
    '壹米滴答': 'yimidida',
    'COE': 'coe',
    '风驰': 'fengchi',
    '威盛': 'wherexpess',
    '易达通': 'qexpress',
    '易达国际': 'eta100',
    '新元国际': 'xynyc',
    '一速递': 'oneexpress',
    '中翼国际': 'chnexp',
    '方舟国际': 'arkexpress',
    '卓志': 'chinaicip',
    '众邮': 'zhongyouex',
    '澳捷': 'ajl',
    '龙行速运': 'longcps',
    '中集冷云': 'cccc58',
    '宏递': 'hd',
    'EFS（平安快递）': 'efs',
    '三盛': 'sansheng',
    '贝海国际': 'xlobo',
    '盛丰': 'sfwl',
    '美快': 'meiquick',
    '速腾': 'suteng',
    '行云': 'xyb2b',
    '海带宝': 'haidaibao',
    '汇森': 'huisenky',
    '丰网': 'fengwang',
    '三象': 'sxexpress',
    '新杰': 'sunjex',
    '科捷': 'kejie',
    '明达': 'tmwexpress',
    '海信': 'savor',
    '哪吒': 'nezha',
    '快捷快': 'gdkjk56',
    '宇鑫': 'yuxinwuliu',
    '联运通': 'szuem',
    '中健云康': 'concare',
    '速邮达': 'suyoda',
    '奔力': 'blex56',
    '泛球': 'fanqiu',
    '极速达': 'jsdky',
    '速必达': 'subida',
    '志方': 'zfex56',
    'Jingle': 'jingleexpress',
    '德坤': 'dekuncn',
    '一站通': 'yztex',
    'OCS': 'ocs',
    '万家': 'wjwl',
    '申通非缓存': 'stonocache',
    '无忧': 'aliexpress',
    'Aramex': 'aramex',
    'Amazon': 'amazon',
    '华通': 'huatong',
    '云途': 'yunexpress',
    '小米': 'xiaomiwuliu',
    '融辉': 'ronghui',
    'Uniuni': 'uniuni',
    'Pig': 'piggyship',
    'RoyalMail': 'royal',
    '万邦': 'wanb',
    '快弟来了': 'kder',
    'YWE': 'ywe',
    '景光': 'jgwl',
    '加拿大邮政': 'canpost',
    'UBI': 'ubi',
    'Sagawa': 'sagawa',
    '佳成': 'jiacheng',
    '日本邮政': 'japanpost',
    '华翰': 'huahanwuliu',
    '上海守务': 'shshouwu',
    '笨鸟': 'benniao',
    '奇普文': 'quipuwin',
    '意大利邮政': 'posteit',
    'EVRI': 'evri',
    'KoreaPost': 'koreapost',
    'GOFO': 'gofo',
    'SwiftX': 'swiftx',
    '顺衍': 'shunyanwl',
    // 保留一些常用的映射，确保兼容性
    '顺丰速运': 'shunfeng',
    '申通快递': 'shentong',
    '圆通速递': 'yuantong',
    '韵达快递': 'yunda',
    '中通快递': 'zhongtong',
    '京东物流': 'jd',
    '邮政': 'youzhengguonei',

    凤凰快递: 'fenghuangkuaidi',
    共速达: 'gongsuda',
    海盟物流: 'haimengwuliu',
    恒路物流: 'hengluwuliu',
    佳吉快运: 'jiajikuaiyun',
    佳怡物流: 'jiayiwuliu',
    建华快递: 'jianhuakuaiyun',
    金大物流: 'jindawuliu',
    晋越快递: 'jinyuekuaidi',
    京广速递: 'jingguangsudi',
    京邮物流: 'jingyouwuliu',
    快捷速递: 'kuaijiesudi',
    蓝弧快递: 'lanhukuaidi',
    龙邦物流: 'longbangwuliu',
    民邦快递: 'minbangkuaidi',
    敏捷快递: 'minjiekuaidi',
    南方物流: 'nanfangwuliu',
    品骏快递: 'pinjunkuaidi',
    全日通: 'quanritong',
    全一快递: 'quanyikuaidi',
    全日通速递: 'quanritongsudi',
    赛澳递: 'saiiaodi',
    盛辉物流: 'shenghuiwuliu',
    盛丰物流: 'shengfengwuliu',
    速尔快递: 'suoerkuaidi',
    中外运: 'zhongwaiyun',
    中邮物流: 'zhongyouwuliu',
    宅急送快递: 'zhaijisongkuaidi',
    奔腾物流: 'bentengwuliu',
    比优速物流: 'biyousuwuliu',
    便利快递: 'bianlikekuaidi',
    CCES快递: 'cceskuaidi',
    CityLink物流: 'citylinkwuliu',
    Daewoo物流: 'daewoowuliu',
    DPEX快递: 'dpexkuaidi',
    EPacket快递: 'epacketkuaidi',
    FedexIP快递: 'fedexipkuaidi',
    FedexIE快递: 'fedexiekuaidi',
    Firstflight快递: 'firstflightkuaidi',
    Force快递: 'forcekuaidi',
    GLS快递: 'glskuaidi',
    Globeflight快递: 'globeflightkuaidi',
    Gogoxpress快递: 'gogoxpresskuaidi',
    GTExpress快递: 'gtexpresskuaidi',
    Hermes快递: 'hermeskuaidi',
    HongKongPost快递: 'hkpostkuaidi',
    IndiaPost快递: 'indiapostkuaidi',
    Indah快递: 'indahkuaidi',
    Interparcel快递: 'interparcelkuaidi',
    JNE快递: 'jnekuaidi',
    KerryExpress快递: 'kerryexpresskuaidi',
    KoreaPost快递: 'koreapostkuaidi',
    LBC快递: 'lbckuaidi',
    LionParcel快递: 'lionparcelkuaidi',
    MailBoxesEtc快递: 'mailboxetkuaidi',
    MondialRelay快递: 'mondialrelaykuaidi',
    NinjaVan快递: 'ninjavankuadi',
    NZPost快递: 'nzpostkuaidi',
    PakistanPost快递: 'pakistanpostkuaidi',
    ParcelForce快递: 'parcelforcekuaidi',
    Parcelhub快递: 'parcelhubkuaidi',
    PitneyBowes快递: 'pitneyboweskuaidi',
    PosteItaliane快递: 'posteitalianekuaidi',
    Poslaju快递: 'poslajukuaidi',
    Qxpress快递: 'qxpresskuaidi',
    RoyalMail快递: 'royalmailkuaidi',
    RussianPost快递: 'russianpostkuaidi',
    Sagawa快递: 'sagawa',
    Sampark快递: 'samparkkuaidi',
    SFExpress快递: 'sf',
    Sicepat快递: 'sicepatkuaidi',
    SingPost快递: 'singpostkuaidi',
    Skynet快递: 'skynetkuaidi',
    SriLankaPost快递: 'slpostkuaidi',
    StarTrack快递: 'startrackkuaidi',
    SwissPost快递: 'swisspostkuaidi',
    TBS快递: 'tbs',
    TNT快递: 'tntkuaidi',
    TaQBin快递: 'taqbinkuaidi',
    ThailandPost快递: 'thailandpostkuaidi',
    Toll快递: 'tollkuaidi',
    Transcorp快递: 'transcorps',
    TurkishPost快递: 'turkishpostkuaidi',
    USPS快递: 'uspskuaidi',
    VietnamPost快递: 'vnpostkuaidi',
    XpressBees快递: 'xpressbeeskuaidi',
    Yamato快递: 'yamatokuaidi',
    Yodel快递: 'yodelkuaidi',
    YunExpress快递: 'yunexpresskuaidi',
    ZIM快递: 'zimkuaidi',
    ZTO快递: 'ztokuaidi',
  };

  constructor(private readonly configService: ConfigService) {}

  // 获取快递公司代码
  getCarrierCode(carrierName: string): string {
    if (!carrierName) return '';
    return this.carrierCodeMap[carrierName] || '';
  }

  // 解析物流状态
  parseLogisticsStatus(statusText: string): string {
    if (!statusText) return 'unknown';

    // 优先精确匹配第三方API返回的7种标准状态
    const standardStatusMap: Record<string, string> = {
      '运输中': 'in_transit',
      '已签收': 'delivered',
      '代收': 'in_transit',
      '无物流': 'no_logistics',
      '疑似无物流': 'suspected_no_logistics',
      '待查询': 'pending_query',
      '异常件': 'exception',
    };

    // 首先检查是否精确匹配第三方API的标准状态
    if (standardStatusMap[statusText]) {
      return standardStatusMap[statusText];
    }

    // 使用数组定义状态映射，确保遍历顺序
    const statusMap = [
      // 已签收状态
      { key: '已签收', value: 'delivered' },
      { key: '签收', value: 'delivered' },
      { key: '簽收', value: 'delivered' },
      { key: '取出', value: 'delivered' },
      { key: '已取出', value: 'delivered' },
      { key: '包裹已从代收点取出', value: 'delivered' },
      { key: '包裹已送至', value: 'delivered' },
      { key: '已送达', value: 'delivered' },
      { key: '派送成功', value: 'delivered' },
      { key: '投递成功', value: 'delivered' },
      { key: '已交付', value: 'delivered' },
      { key: '已完成', value: 'delivered' },
      { key: '完成', value: 'delivered' },
      { key: '妥投', value: 'delivered' },
      { key: '完成取件', value: 'delivered' },
      { key: '收件人已取走邮件', value: 'delivered' },
      { key: '已完成配送', value: 'delivered' },
      { key: '客户已取件', value: 'delivered' },
      { key: '由收件人领取', value: 'delivered' },
      { key: 'signed', value: 'delivered' },
      { key: 'delivered', value: 'delivered' },
      { key: '邮件已取走', value: 'delivered' },
      { key: '已由客户自提', value: 'delivered' },
      { key: '自提已接收', value: 'delivered' },
      { key: '被签收', value: 'delivered' },
      { key: '包裹已送货上门', value: 'delivered' },
      { key: '已确认收货', value: 'delivered' },
      { key: '全部快件派送完成', value: 'delivered' },
      { key: '收件人为', value: 'delivered' },
      { key: '签收人在', value: 'delivered' },
      { key: '取件', value: 'delivered' },

      // 退回状态
      { key: '退件', value: 'returning' },
      { key: '已退回', value: 'returning' },
      { key: '退回', value: 'returning' },
      { key: '被退回', value: 'returning' },

      // 取消状态
      { key: '已取消', value: 'cancelled' },
      { key: '取消', value: 'cancelled' },
      { key: '客户已取消寄件', value: 'cancelled' },
      { key: '您的快件取消成功', value: 'cancelled' },

      // 运输中状态
      { key: '配送中', value: 'in_transit' },
      { key: '运输中', value: 'in_transit' },
      { key: '派送中', value: 'in_transit' },
      { key: '运输', value: 'in_transit' },
      { key: '派件', value: 'in_transit' },
      { key: '已发货', value: 'shipped' },
      { key: '已揽收', value: 'shipped' },
      { key: '揽收', value: 'shipped' },
      { key: '发货', value: 'shipped' },
      { key: '发往', value: 'in_transit' },
      { key: '运往', value: 'in_transit' },
      { key: '前往', value: 'in_transit' },
      { key: '中转', value: 'in_transit' },
      { key: '转站', value: 'in_transit' },
      { key: '已到达', value: 'in_transit' },
      { key: '已进站', value: 'in_transit' },
      { key: '已出站', value: 'in_transit' },
      { key: '已发出', value: 'in_transit' },
      { key: '已离开', value: 'in_transit' },
      { key: '正在派送', value: 'in_transit' },
      { key: '派送中', value: 'in_transit' },
      { key: '配送中', value: 'in_transit' },
      { key: '代收', value: 'in_transit' },
      { key: '代签', value: 'in_transit' },
      { key: '驿站', value: 'in_transit' },
      { key: '代理', value: 'in_transit' },
      { key: '丰巢', value: 'in_transit' },
      { key: '自提柜', value: 'in_transit' },
      { key: '自提点', value: 'in_transit' },
      { key: '快递柜', value: 'in_transit' },
      { key: '入柜', value: 'in_transit' },
      { key: '百世邻里', value: 'in_transit' },
      { key: '快递超市', value: 'in_transit' },
      { key: '熊猫快收', value: 'in_transit' },
      { key: '腾云小站', value: 'in_transit' },
      { key: '速递易', value: 'in_transit' },
      { key: '百世快递店', value: 'in_transit' },
      { key: '您的快件已存放在【', value: 'in_transit' },
      { key: '取货码', value: 'in_transit' },
      { key: '小栈', value: 'in_transit' },
      { key: '溪鸟', value: 'in_transit' },
      { key: '递驿优', value: 'in_transit' },
      { key: '易收发', value: 'in_transit' },
      { key: '邻里驿站', value: 'in_transit' },
      { key: '小兵驿站', value: 'in_transit' },
      { key: '乐收', value: 'in_transit' },
      { key: '近邻宝', value: 'in_transit' },
      { key: '和驿', value: 'in_transit' },
      { key: '兔喜柜', value: 'in_transit' },
      { key: '喵站', value: 'in_transit' },
      { key: '蜂站', value: 'in_transit' },
      { key: '投递到', value: 'in_transit' },
      { key: '已暂存至', value: 'in_transit' },

      // 待处理状态
      { key: '待配送', value: 'pending_delivery' },
      { key: '待揽收', value: 'pending_pickup' },
      { key: '待发货', value: 'pending_pickup' },
      { key: '待处理', value: 'pending_pickup' },

      // 异常状态
      { key: '异常', value: 'exception' },
      { key: '问题件', value: 'exception' },
      { key: '问题', value: 'exception' },
      { key: '延误', value: 'exception' },
      { key: '超时', value: 'exception' },
      { key: '失败', value: 'exception' },
      { key: '派送不成功', value: 'exception' },
      { key: '未妥投', value: 'exception' },
      { key: '反签收', value: 'exception' },
      { key: '拒签', value: 'exception' },
      { key: '无法', value: 'exception' },
      { key: '未通过', value: 'exception' },
      { key: '异常件', value: 'exception' },
      { key: '拒收', value: 'exception' },
      { key: '待进一步处理', value: 'exception' },
      { key: '转寄更改单', value: 'exception' },
      { key: '退货', value: 'exception' },
      { key: '无法正常派送', value: 'exception' },

      // 无物流状态
      { key: '无物流', value: 'no_logistics' },
      { key: '疑似无物流', value: 'suspected_no_logistics' },
      { key: '待查询', value: 'pending_query' },
    ];

    for (const { key, value } of statusMap) {
      if (statusText.includes(key)) {
        return value;
      }
    }

    return 'unknown';
  }

  // 格式化物流记录
  formatLogisticsRecord(record: any): any {
    if (!record) return null;

    return {
      time: record.time || '',
      location: record.location || '',
      description: record.description || record.context || '',
      status: this.parseLogisticsStatus(
        record.description || record.context || '',
      ),
    };
  }

  // 获取物流API配置
  getLogisticsConfig(): Record<string, any> {
    return {
      appid: this.configService.get('LOGISTICS_APPID', 346462),
      outerid: this.configService.get('LOGISTICS_OUTERID', '5DAD3AA8098741C0'),
    };
  }

  // 获取物流API基础URL
  getLogisticsApiBaseUrl(): string {
    return (
      this.configService.get('LOGISTICS_API_BASE_URL') ||
      'http://yun.zhuzhufanli.com/mini/'
    );
  }

  // 映射物流状态到OrderStatus枚举
  mapLogisticsStatus(statusText: string): string {
    const parsedStatus = this.parseLogisticsStatus(statusText);

    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      in_transit: 'in_transit',
      shipped: 'in_transit',
      pending_delivery: 'in_transit',
      pending_pickup: 'pending',
      exception: 'exception',
      returning: 'returned',
      cancelled: 'pending',
      unknown: 'pending',
      no_logistics: 'pending',
      suspected_no_logistics: 'exception',
      pending_query: 'pending',
    };

    return statusMap[parsedStatus] || 'pending';
  }

  // 解析物流详情
  parseTrackingDetails(trackingDetails: string): any[] {
    if (!trackingDetails || trackingDetails === '//太长省略//') {
      // 当物流详情为空时，返回一个包含至少一条基础物流记录的数组
      return [
        {
          time: new Date().toLocaleString(),
          timestamp: new Date().toISOString(),
          description: '物流信息查询中，请稍后再试',
          status: 'pending',
          areaCode: '',
          areaName: '',
          type: 'TRANSIT',
          location: '',
        },
      ];
    }

    const nodes: any[] = [];

    try {
      // 尝试将字符串解析为JSON数组
      const details = JSON.parse(trackingDetails);
      if (Array.isArray(details)) {
        return details.map(this.formatLogisticsRecord.bind(this));
      }
    } catch (error) {
      // 如果解析失败，尝试其他格式
    }

    // 尝试解析HTML格式的物流信息
    try {
      // 使用正则表达式提取物流节点：每个节点是 "描述<br><i>时间</i>"
      const nodeRegex = /([^<]+)<br><i>([^<]+)<\/i>/g;
      let match;

      while ((match = nodeRegex.exec(trackingDetails)) !== null) {
        const description = match[1].trim();
        const timeStr = match[2].trim();

        if (description && timeStr) {
          // 尝试解析时间字符串为Date对象
          const timestamp = new Date(timeStr).toISOString();

          nodes.push({
            time: timeStr,
            timestamp: timestamp,
            description,
            status: this.parseLogisticsStatus(description),
            areaCode: '',
            areaName: '',
            type: 'TRANSIT',
            location: '',
          });
        }
      }
    } catch (error) {
      // 如果HTML解析失败，尝试其他格式
    }

    // 如果没有匹配到，尝试第二种格式（用 | 分隔的文本）
    if (nodes.length === 0) {
      const lines = trackingDetails.split('\n');
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          const timeStr = parts[0].trim();
          const description = parts.slice(1).join('|').trim();
          if (description && timeStr) {
            const timestamp = new Date(timeStr).toISOString();

            nodes.push({
              time: timeStr,
              timestamp: timestamp,
              description,
              status: this.parseLogisticsStatus(description),
              areaCode: '',
              areaName: '',
              type: 'TRANSIT',
              location: '',
            });
          }
        }
      }
    }

    // 如果仍然没有匹配到，返回一个包含至少一条基础物流记录的数组
    if (nodes.length === 0) {
      return [
        {
          time: new Date().toLocaleString(),
          timestamp: new Date().toISOString(),
          description: '暂无详细物流信息',
          status: 'pending',
          areaCode: '',
          areaName: '',
          type: 'TRANSIT',
          location: '',
        },
      ];
    }

    return nodes;
  }

  requiresPhoneVerification(carrierCode: string): boolean {
    const carriersRequiringPhone = ['shunfeng', 'zhongtong'];
    return carriersRequiringPhone.includes(carrierCode);
  }

  getStatusPriority(status: string): number {
    const priorityMap: Record<string, number> = {
      'pending': 0,
      'in_transit': 1,
      'exception': 50,
      'delivered': 99,
      'returned': 99,
    };
    return priorityMap[status] || 0;
  }

  shouldUpdateOrderStatus(currentStatus: string, newStatus: string): boolean {
    const currentPriority = this.getStatusPriority(currentStatus);
    const newPriority = this.getStatusPriority(newStatus);
    return currentPriority <= newPriority;
  }
}
