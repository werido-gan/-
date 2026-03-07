export enum OrderStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  RETURNED = 'returned',
  EXCEPTION = 'exception',
}

// 订单状态中文映射
export const ORDER_STATUS_MAP: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待发货',
  [OrderStatus.IN_TRANSIT]: '运输中',
  [OrderStatus.DELIVERED]: '已签收',
  [OrderStatus.RETURNED]: '已退回',
  [OrderStatus.EXCEPTION]: '运输异常',
};

export interface TrackingNode {
  id: string;
  timestamp: string;
  location: string;
  description: string;
}

// 部门接口
export interface Department {
  id: number;         // 部门ID
  key: string;        // 部门唯一标识
  name: string;       // 部门名称
  description?: string; // 部门描述（可选）
  created_at?: string; // 创建时间（可选）
}

// 预警状态
export enum WarningStatus {
  NONE = 'none',
  DELAY_SHIPMENT = 'delay_shipment',
  TRANSIT_ABNORMAL = 'transit_abnormal'
}

// 预警状态中文映射
export const WARNING_STATUS_MAP: Record<WarningStatus, string> = {
  [WarningStatus.NONE]: '无预警',
  [WarningStatus.DELAY_SHIPMENT]: '延迟发货',
  [WarningStatus.TRANSIT_ABNORMAL]: '运输异常',
};

export interface Order {
  id: number;
  order_number: string; // 物流单号
  customer_name: string;   // 客户/项目名称
  department_key: string;     // 业务部门（存储部门key）
  user_id?: number;     // 创建订单的用户ID
  carrier?: string;    // 承运商名称
  carrier_code?: string;    // 承运商代码，用于调用物流API
  status: OrderStatus;
  warning_status: WarningStatus; // 预警状态
  is_archived: boolean;    // 逻辑删除标记
  details?: any; // 存储轨迹、目的地等扩展信息
  created_at: string;     // 创建时间
  updated_at: string;     // 更新时间
}

export interface DepartmentStats {
  key: string;        // 部门key
  name: string;       // 部门名称
  total: number;
  pending: number;
  inTransit: number;
  delivered: number;
  returned: number;
  riskCount: number; // 5天未发货
  warningCount: number; // 总预警数
  delayShipmentCount: number; // 延迟发货预警数
  transitAbnormalCount: number; // 运输异常预警数
}

// 操作日志接口
// 操作类型枚举
export enum OperationType {
  IMPORT = 'import',
  EXPORT = 'export',
  DELETE = 'delete',
  ARCHIVE = 'archive',
  RESTORE = 'restore',
  UPDATE = 'update',
  CREATE = 'create',
  LOGIN = 'login',
  LOGOUT = 'logout'
}

// 目标类型枚举
export enum TargetType {
  ORDER = 'order',
  USER = 'user',
  DEPARTMENT = 'department',
  SYSTEM = 'system'
}

export interface OperationLog {
  id: number;
  user_id?: number;
  username?: string;
  operation_type: OperationType;
  target_type?: TargetType;
  target_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

// 筛选条件接口
export interface FilterCriteria {
  department?: string;
  dateRange?: { start: string; end: string };
  status?: OrderStatus;
  carrier?: string;
  warningStatus?: WarningStatus;
  searchTerm?: string; // 搜索关键词（单号/客户）
}

// 导入结果接口
export interface ImportResult {
  success: boolean;
  importedCount: number;
  failedCount: number;
  errors?: Array<{ row: number; message: string }>;
}

// 部门字典维护
export const DEPARTMENT_DICT: Record<string, Department> = {
  'EAST': { id: 1, key: 'EAST', name: '华东事业部', description: '负责华东地区业务' },
  'SOUTH': { id: 2, key: 'SOUTH', name: '华南事业部', description: '负责华南地区业务' },
  'NORTH': { id: 3, key: 'NORTH', name: '华北事业部', description: '负责华北地区业务' },
  'WEST': { id: 4, key: 'WEST', name: '华西事业部', description: '负责华西地区业务' },
  'CENTRAL': { id: 5, key: 'CENTRAL', name: '华中事业部', description: '负责华中地区业务' },
  'OVERSEAS': { id: 6, key: 'OVERSEAS', name: '海外业务部', description: '负责海外业务' },
};

// 部门列表（用于下拉选择等场景）
export const DEPARTMENTS = Object.values(DEPARTMENT_DICT);

// 快递公司代码映射
export const CARRIER_CODES: Record<string, string> = {
  // 主流快递公司
  '顺丰速运': 'shunfeng',
  '顺丰': 'shunfeng',
  '圆通快递': 'yuantong',
  '圆通': 'yuantong',
  '中通快递': 'zhongtong',
  '中通': 'zhongtong',
  '申通快递': 'shentong',
  '申通': 'shentong',
  '韵达快递': 'yunda',
  '韵达': 'yunda',
  '百世快递': 'baishiwuliu',
  '百世': 'baishiwuliu',
  '京东物流': 'jingdong',
  '京东': 'jingdong',
  '邮政快递包裹': 'youzheng',
  '邮政': 'youzheng',
  'ems': 'ems',
  '宅急送': 'zhaijisong',
  '优速快递': 'youshuwuliu',
  '优速': 'youshuwuliu',
  '天天快递': 'tiantian',
  '天天': 'tiantian',
  '德邦快递': 'debangwuliu',
  '德邦': 'debangwuliu',
  '跨越速运': 'kuayuesuyun',
  '极兔速递': 'jitasudi',
  '极兔': 'jitasudi',
  '安能物流': 'annengwuliu',
  '中铁物流': 'zhongtiewuliu',
  '民航快递': 'minhangkuaidi',
  '速尔快递': 'suoerkuaidi',
  '快捷快递': 'kuaijiekuaidi',
  '全峰快递': 'quanfengkuaidi',
  '国通快递': 'guotongkuaidi',
  '增益速递': 'zengyisudi',
  '汇通快递': 'huitongkuaidi',
  '全一快递': 'quanyikuaidi',
  'fedex': 'fedex',
  'ups': 'ups',
  'dhl': 'dhl',
  'tnt': 'tnt',
  '云鸟': 'yuniao',
  '韵达宝': 'yundabao',
  '汇元速运': 'huiyuansuyun',
  '网赚': 'wangzhuan',
  '三象': 'sanxiang',
  '捷速': 'jiesu',
  '利速': 'lisuo',
  '鸿远': 'hongyuan',
  '安速全': 'ansuquan',
  '行云': 'xysb',
  '淘书宝': 'taoshu5',
  '汇元': 'huilyun',
  '三网': 'sannet',
  '捷递': 'jiespeed',
  '润达': 'runexpress',
  '安诺': 'anno',
  '泛捷': 'fanjet',
  '泛捷国际': 'fanjet',
  '中豪云达': 'zhonghaoyunda',
  '蓝店': 'landian',
  '中港速运': 'zhonggangsuyun',
  '全晨快递': 'quanchenkuaidi',
  '全日通快递': 'quanritongkuaidi',
  '安信达': 'anxinda',
  '百福东方': 'baifudongfang',
  '彪记快递': 'biaojikuaidi',
  '大田物流': 'datianwuliu',
  '东方物流': 'dongfangwuliu',
  '飞康达': 'feikangda',
  '凤凰快递': 'fenghuangkuaidi',
  '共速达': 'gongsuda',
  '海盟物流': 'haimengwuliu',
  '恒路物流': 'hengluwuliu',
  '佳吉快运': 'jiajikuaiyun',
  '佳怡物流': 'jiayiwuliu',
  '建华快递': 'jianhuakuaiyun',
  '金大物流': 'jindawuliu',
  '晋越快递': 'jinyuekuaidi',
  '京广速递': 'jingguangsudi',
  '京邮物流': 'jingyouwuliu',
  '快捷速递': 'kuaijiesudi',
  '蓝弧快递': 'lanhukuaidi',
  '联昊通': 'lianhaotong',
  '龙邦物流': 'longbangwuliu',
  '民邦快递': 'minbangkuaidi',
  '敏捷快递': 'minjiekuaidi',
  '南方物流': 'nanfangwuliu',
  '品骏快递': 'pinjunkuaidi',
  '全日通': 'quanritong',
  '全日通速递': 'quanritongsudi',
  '如风达': 'rufengda',
  '赛澳递': 'saiiaodi',
  '盛辉物流': 'shenghuiwuliu',
  '盛丰物流': 'shengfengwuliu',
  '天地华宇': 'tiandihuayu',
  '中外运': 'zhongwaiyun',
  '中邮物流': 'zhongyouwuliu',
  '斑马物流': 'banmawuliu',
  '奔腾物流': 'bentengwuliu',
  '比优速物流': 'biyousuwuliu',
  'CCES快递': 'cceskuaidi',
  'City-Link物流': 'citylinkwuliu',
  'Daewoo物流': 'daewoowuliu',
  'DPEX快递': 'dpexkuaidi',
  'E-Packet快递': 'epacketkuaidi',
  'Fedex IP快递': 'fedexipkuaidi',
  'Fedex IE快递': 'fedexiekuaidi',
  'Firstflight快递': 'firstflightkuaidi',
  'Force快递': 'forcekuaidi',
  'GLS快递': 'glskuaidi',
  'Globeflight快递': 'globeflightkuaidi',
  'Gogoxpress快递': 'gogoxpresskuaidi',
  'GT Express快递': 'gtexpresskuaidi',
  'Hermes快递': 'hermeskuaidi',
  'Hong Kong Post快递': 'hkpostkuaidi',
  'India Post快递': 'indiapostkuaidi',
  'Indah快递': 'indahkuaidi',
  'Interparcel快递': 'interparcelkuaidi',
  'JNE快递': 'jnekuaidi',
  'Kerry Express快递': 'kerryexpresskuaidi',
  'Korea Post快递': 'koreapostkuaidi',
  'LBC快递': 'lbckuaidi',
  'Lion Parcel快递': 'lionparcelkuaidi',
  'Mail Boxes Etc.快递': 'mailboxetkuaidi',
  'Mondial Relay快递': 'mondialrelaykuaidi',
  'Ninja Van快递': 'ninjavankuadi',
  'NZ Post快递': 'nzpostkuaidi',
  'Pakistan Post快递': 'pakistanpostkuaidi',
  'Parcel Force快递': 'parcelforcekuaidi',
  'Parcelhub快递': 'parcelhubkuaidi',
  'Pitney Bowes快递': 'pitneyboweskuaidi',
  'Poste Italiane快递': 'posteitalianekuaidi',
  'Poslaju快递': 'poslajukuaidi',
  'Qxpress快递': 'qxpresskuaidi',
  'Royal Mail快递': 'royalmailkuaidi',
  'Russian Post快递': 'russianpostkuaidi',
  'Sagawa快递': 'sagawa kuadi',
  'Sampark快递': 'samparkkuaidi',
  'SF Express快递': 'sfexpresskuaidi',
  'Sicepat快递': 'sicepatkuaidi',
  'SingPost快递': 'singpostkuaidi',
  'Skynet快递': 'skynetkuaidi',
  'Sri Lanka Post快递': 'slpostkuaidi',
  'StarTrack快递': 'startrackkuaidi',
  'Swiss Post快递': 'swisspostkuaidi',
  'TBS快递': 'tbs kuadi',
  'TNT快递': 'tntkuaidi',
  'Ta-Q-Bin快递': 'taqbinkuaidi',
  'Thailand Post快递': 'thailandpostkuaidi',
  'Toll快递': 'tollkuaidi',
  'Transcorp快递': 'transcorps快递',
  'Turkish Post快递': 'turkishpostkuaidi',
  'USPS快递': 'uspskuaidi',
  'Vietnam Post快递': 'vnpostkuaidi',
  'XpressBees快递': 'xpressbeeskuaidi',
  'Yamato快递': 'yamatokuaidi',
  'Yodel快递': 'yodelkuaidi',
  'YunExpress快递': 'yunexpresskuaidi',
  'ZIM快递': 'zimkuaidi',
  'ZTO快递': 'ztokuaidi',
  '安速全物流': 'ansuquan',
  '通吧': 'tongba',
  '上海城铁快运': 'shanghaichengti',
  '宇鑫物流': 'yuxinwuliu',
  '中城速递': 'zhongchengsudi',
  '速必达': 'subida',
  '迈力': 'maili',
  '安骏': 'anjun',
  '顿发送达': 'dunsongsd',
  '通必达': 'tongbida',
  '思必达': 'sibida',
  'jingle': 'jingle',
  '速通': 'sutong',
  '一快通': 'yikuaitong',
  '万承': 'wancheng',
  '佳速物流': 'jiasusongcheng',
  'JMS EXPRESS': 'jms',
  '国通速递': 'guotongsudi',
  'Acme': 'acme',
  'Air21': 'air21',
  'Alza': 'alza',
  'Aramex': 'aramex',
  'Atos': 'atos',
  '巴西邮政': 'baxizhengyou',
  '斑马': 'banma',
  '奔腾': 'benteng',
  '比优速': 'biyousu',
  '便利快递': 'bianlike',
  'CCES': 'cces',
  'City-Link': 'citylink',
  'Daewoo': 'daewoo',
  'DPEX': 'dpex',
  'E-Packet': 'epacket',
  'Fedex IP': 'fedexip',
  'Fedex IE': 'fedexie',
  'Firstflight': 'firstflight',
  'Force': 'force',
  'GLS': 'gls',
  'Globeflight': 'globeflight',
  'Gogoxpress': 'gogoxpress',
  'GT Express': 'gtexpress',
  'Hermes': 'hermes',
  'Hong Kong Post': 'hkpost',
  'India Post': 'indiapost',
  'Indah': 'indah',
  'Interparcel': 'interparcel',
  'JNE': 'jne',
  'Kerry Express': 'kerryexpress',
  'Korea Post': 'koreapost',
  'LBC': 'lbc',
  'Lion Parcel': 'lionparcel',
  'Mail Boxes Etc.': 'mailboxet',
  'Mondial Relay': 'mondialrelay',
  'Ninja Van': 'ninjavan',
  'NZ Post': 'nzpost',
  'Pakistan Post': 'pakistanpost',
  'Parcel Force': 'parcelforce',
  'Parcelhub': 'parcelhub',
  'Pitney Bowes': 'pitneybowes',
  'Poste Italiane': 'posteitaliane',
  'Poslaju': 'poslaju',
  'Qxpress': 'qxpress',
  'Royal Mail': 'royalmail',
  'Russian Post': 'russianpost',
  'Sagawa': 'sagawa',
  'Sampark': 'sampark',
  'SF Express': 'sf',
  'Sicepat': 'sicepat',
  'SingPost': 'singpost',
  'Skynet': 'skynet',
  'Sri Lanka Post': 'slpost',
  'StarTrack': 'startrack',
  'Swiss Post': 'swisspost',
  'TBS': 'tbs',
  'TNT': 'tnt',
  'Ta-Q-Bin': 'taqbin',
  'Thailand Post': 'thailandpost',
  'Toll': 'toll',
  'Transcorp': 'transcorp',
  'Turkish Post': 'turkishpost',
  'USPS': 'usps',
  'Vietnam Post': 'vnpost',
  'XpressBees': 'xpressbees',
  'Yamato': 'yamato',
  'Yodel': 'yodel',
  'YunExpress': 'yunexpress',
  'ZIM': 'zim',
  'ZTO': 'zto',
  '全峰': 'quanfengkuaidi',
  '国通': 'guotongkuaidi',
  '增益': 'zengyisudi',
  '汇通': 'huitongkuaidi',
  '全一': 'quanyikuaidi',
  '速尔': 'suoerkuaidi',
  '快捷': 'kuaijiekuaidi',
  '民航': 'minhangkuaidi',
  '中铁': 'zhongtiewuliu',
  '安能': 'annengwuliu',
  '跨越': 'kuayuesuyun',
  '圆通速递': 'yuantong',
  '中通速递': 'zhongtong',
  '邮政快递': 'youzheng',
  'ems特快': 'ems',
  '德邦物流': 'debangwuliu',
  '百世汇通': 'baishihuitong',
  '极兔快递': 'jitasudi',
  '宅急送快递': 'zhaijisong',
  '优速物流': 'yousu',
  '增益快递': 'zengyisudi',
  '中铁快运': 'zhongtiekuyaun',
  'fedex国际': 'fedex',
  'ups国际': 'ups',
  'dhl国际': 'dhl',
  'tnt国际': 'tnt',
  '云鸟物流': 'yuniao',
  '韵达宝物流': 'yundabao',
  '汇元速运物流': 'huiyuansuyun',
  '网赚物流': 'wangzhuan',
  '三象物流': 'sanxiang',
  '捷速物流': 'jiesu',
  '利速物流': 'lisuo',
  '鸿远物流': 'hongyuan'
};

// 根据快递公司名称获取代码
export const getCarrierCode = (carrierName: string): string => {
  // 确保返回的代码是第三方API支持的
  const supportedCarriers: Record<string, string> = {
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
  };
  
  return supportedCarriers[carrierName] || CARRIER_CODES[carrierName] || 'shunfeng'; // 默认使用顺丰
};

// 角色枚举
export enum Role {
  ADMIN = 'admin',
  USER = 'user'
}

// 用户接口
export interface User {
  id: number;
  username: string;
  password: string;
  email?: string;
  department?: string;
  phone?: string;
  role: Role;
  created_at: string;
  updated_at?: string;
  last_login?: string;
}

// 认证状态接口
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  csrfToken: string | null;
}