export interface LogisticsData {
  kddh: string;
  kdgs: string;
  wuliuzhuangtai: string;
  tiaoshu: number;
  fachushijian: string;
  zuixinshijian: string;
  zuihouwuliu: string;
  xiangxiwuliu: string;
  chaxunshijian: string;
  dingdanhao: string;
  wwlyuan: string;
}

export interface LogisticsSelectResponse {
  code: number;
  msg: {
    jindu: number;
    totalpage: number;
    list: LogisticsData[];
  };
}
