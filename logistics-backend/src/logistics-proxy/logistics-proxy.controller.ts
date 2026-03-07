import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import * as http from 'http';
import * as querystring from 'querystring';
import { TrackingNumberRecognitionService } from './services/tracking-number-recognition.service';
import { OrdersService } from '../orders/services/orders.service';
import { OrderStatus, WarningStatus } from '../orders/entities/order.entity';
import {
  LogisticsSelectResponse,
  LogisticsData,
} from './types/logistics-data.interface';
import { LogisticsUtilService } from './utils/logistics-util.service';

@Controller('logistics-proxy')
export class LogisticsProxyController {
  private readonly logger = new Logger(LogisticsProxyController.name);
  private readonly logisticsApiBaseUrl = 'http://yun.zhuzhufanli.com/mini/';
  private readonly logisticsConfig = {
    appid: 346462,
    outerid: '5DAD3AA8098741C0',
  };

  constructor(
    private readonly trackingNumberRecognitionService: TrackingNumberRecognitionService,
    private readonly ordersService: OrdersService,
    private readonly logisticsUtilService: LogisticsUtilService,
  ) {}

  private async httpPost(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlParts = new URL(url);
      const postData = querystring.stringify(data);
      const options = {
        hostname: urlParts.hostname,
        port: urlParts.port || 80,
        path: urlParts.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };
      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            resolve(responseData);
          }
        });
      });
      req.on('error', (error) => {
        reject(error);
      });
      req.write(postData);
      req.end();
    });
  }

  // 单个物流查询接口
  @Post('query')
  async proxyQuery(@Body() body: any) {
    try {
      console.log('=== 开始处理单个物流查询请求 ===');
      console.log('前端传递的参数:', JSON.stringify(body, null, 2));

      const { kddh, kdgs, phone } = body;

      // 参数验证
      if (!kddh) {
        return {
          success: false,
          data: null,
          message: '物流单号不能为空'
        };
      }

      if (!kdgs) {
        return {
          success: false,
          data: null,
          message: '快递公司代码不能为空'
        };
      }

      // 构建查询参数
      const params = {
        ...this.logisticsConfig,
        kdgs: kdgs,
        kddh: kddh
      };

      // 如果有手机号，添加手机尾号
      if (phone) {
        const phoneStr = String(phone).trim();
        if (phoneStr.length >= 4) {
          params.kddh = `${kddh}||${phoneStr.slice(-4)}`;
        }
      }

      console.log('传递给物流API的参数:', JSON.stringify(params, null, 2));

      // 调用物流API
      const response = await this.httpPost(
        this.logisticsApiBaseUrl + 'query/',
        params
      );
      console.log('物流API返回的响应:', JSON.stringify(response, null, 2));

      console.log('=== 单个物流查询请求处理完成 ===');

      // 包装成ApiResponse格式返回给前端
      return {
        success: response.code === 1,
        data: response.code === 1 ? response.msg : null,
        message: response.code === 1 ? '查询成功' : response.msg
      };
    } catch (error) {
      console.error('单个物流查询时发生错误:', error);
      return {
        success: false,
        data: null,
        message: (error as Error).message
      };
    }
  }

  // ★★★ 新增接口：用于进度条 ★★★
  @Post('create')
  async proxyCreate(@Body() body: any) {
    try {
      console.log('=== 开始处理创建任务请求 ===');
      console.log('前端传递的参数:', JSON.stringify(body, null, 2));

      const params = {
        ...this.logisticsConfig,
        zffs: 'jinbi',
        isBackTaskName: 'yes',
        ...body,
      };
      console.log('传递给物流API的参数:', JSON.stringify(params, null, 2));

      const response = await this.httpPost(
        this.logisticsApiBaseUrl + 'create/',
        params,
      );
      console.log('物流API返回的响应:', JSON.stringify(response, null, 2));

      console.log('=== 创建任务请求处理完成 ===');

      // 包装成ApiResponse格式返回给前端
      return {
        success: response.code === 1,
        data: response,
        message: response.code === 1 ? '创建任务成功' : response.msg,
      };
    } catch (error) {
      console.error('创建任务时发生错误:', error);
      return {
        success: false,
        data: null,
        message: (error as Error).message,
      };
    }
  }

  @Post('select')
  async proxySelect(@Body() body: any) {
    try {
      console.log('=== 开始处理查询任务请求 ===');
      console.log('前端传递的参数:', JSON.stringify(body, null, 2));

      const params = { ...this.logisticsConfig, ...body };
      console.log('传递给物流API的参数:', JSON.stringify(params, null, 2));

      let response;
      const retryCount = 0;
      const maxRetries = 5;

      try {
        response = await this.httpPost(
          this.logisticsApiBaseUrl + 'select/',
          params,
        );
        console.log('物流API返回的响应:', JSON.stringify(response, null, 2));
      } catch (error) {
        console.error('查询任务失败:', error);
        // 直接返回错误响应，不进行重试
        return {
          success: false,
          data: null,
          message: (error as Error).message || '查询任务失败',
        };
      }

      console.log('=== 查询任务请求处理完成 ===');

      // 检查response是否存在
      if (!response) {
        return {
          success: false,
          data: null,
          message: '查询任务失败：无法获取响应',
        };
      }

      // 包装成ApiResponse格式返回给前端
      return {
        success: response.code === 1,
        data: response,
        message: response.code === 1 ? '查询任务成功' : response.msg,
      };
    } catch (error) {
      console.error('查询任务时发生错误:', error);
      return {
        success: false,
        data: null,
        message: (error as Error).message || '查询任务失败',
      };
    }
  }

  // 获取订单进度接口
  @Get('order-progress/:id')
  async getOrderProgress(@Param('id') id: number) {
    try {
      const order = await this.ordersService.getOrderById(id);
      if (!order) {
        return {
          success: false,
          data: null,
          message: '订单不存在'
        };
      }
      return {
        success: true,
        data: {
          progress: order.details?.logisticsQueryProgress || 0,
          status: order.details?.logisticsQueryStatus || '处理中...'
        }
      };
    } catch (error) {
      console.error('获取订单进度失败:', error);
      return {
        success: false,
        data: null,
        message: (error as Error).message || '获取订单进度失败'
      };
    }
  }

  // ★★★ 修复后的核心接口：带重试、防崩坏 ★★★
  @Post('query-and-sync')
  async queryAndSyncLogistics(@Body() requestData: any) {
    try {
      const {
        kddh,
        kdgs,
        customer_name = '未知客户',
        department_key = 'EAST',
        phone,
        isManualRefresh = false,
      } = requestData;

      console.log('=== 处理物流查询请求 ===');
      console.log('请求参数:', JSON.stringify(requestData, null, 2));

      // ✅ 修复1：强制转字符串，防止500报错
      const phoneStr = phone ? String(phone).trim() : '';

      // ✅ 优化参数验证
      if (!kddh)
        return {
          code: 0,
          msg: {
            order: null,
            logisticsInfo: null,
            logisticsQuerySuccess: false,
            logisticsQueryError: '物流单号不能为空'
          }
        };

      // 1. 查找或创建订单
      let order: any = null;
      try {
        // 使用新添加的getOrderByOrderNumber方法精确查找订单
        order = await this.ordersService.getOrderByOrderNumber(kddh);
      } catch (error) {
        console.error('查找订单失败:', error);
      }

      // 2. 识别快递公司
      let carrierCode = kdgs;
      let carrierName = '';

      console.log('=== 承运商识别开始 ===');
      console.log('前端传递的kdgs:', kdgs);
      console.log('订单信息:', order ? `ID: ${order.id}, carrier_code: ${order.carrier_code}, carrier: ${order.carrier}` : '订单不存在');

      // 确保carrierCode有默认值
      if (!carrierCode) carrierCode = 'auto'; // 使用auto让第三方物流API自动识别快递公司

      console.log('初始carrierCode:', carrierCode);

      // 如果订单存在，优先使用订单中的 carrier_code 和 carrier 字段
      if (order) {
        carrierCode = order.carrier_code || carrierCode;
        carrierName = order.carrier || carrierName;
        console.log('使用订单中的承运商信息 - carrierCode:', carrierCode, ', carrierName:', carrierName);
      } else {
        // 不再使用本地规则识别，只使用批量处理的快递代码映射
        // 无论是否指定快递公司，都需要设置carrierName
        const carrierMap: Record<string, string> = {
          yuantong: '圆通速递',
          jingdong: '京东物流',
          kuayuesuyun: '跨越速运',
          shentong: '申通快递',
          zhongtong: '中通快递',
          shunfeng: '顺丰速运',
          tiantian: '天天快递',
          yunda: '韵达快递',
          jd: '京东物流',
          ems: 'EMS',
          huitongkuaidi: '百世快递',
          debangwuliu: '德邦物流',
          kuayue: '跨越速运',
          annengwuliu: '安能物流',
          youshuwuliu: '优速快递',
          zhaijisong: '宅急送',
          quanfengkuaidi: '全峰快递',
          guotongkuaidi: '国通快递',
          jiayunmeiwuliu: '加运美物流',
          suer: '速尔快递',
          yuanchengwuliu: '远成物流',
          zhimakaimen: '菜鸟',
          quanyikuaidi: '全一快递',
          longbanwuliu: '龙邦物流',
          xinfengwuliu: '信丰物流',
          suning: '苏宁物流',
          jiajiwuliu: '佳吉物流',
          dsukuaidi: 'D速快递',
          yafengsudi: '亚风速递',
          zhongtiekuaiyun: '中铁快运',
          tiandihuayu: '天地华宇',
          nanjingshengbang: '晟邦物流',
          disifang: '递四方',
          blueskyexpress: '蓝天国际',
          flyway: '程光物流',
          ftd: '富腾达',
          zhuanyunsifang: '转运四方',
          ausexpress: '澳世快递',
          aolau: 'AOL澳通',
          auexpress: '澳邮中国快运',
          fedex: 'FedEx',
          fedexcn: 'FedEx中文',
          ups: 'UPS',
          pjbest: '品骏快递',
          changjiang: '长江国际',
          banma: '斑马物流',
          jieanda: '捷安达',
          cncexp: 'C＆C',
          polarexpress: '极地快递',
          quansu: '全速快运',
          youyou: '优优快递',
          auto: '自动识别',
          huangmajia: '黄马甲',
          dongjun: '东骏物流',
          zengyisudi: '增益速递',
          kfwnet: '快服务',
          rrs: '日日顺',
          xinbangwuliu: '新邦物流',
          yuntongkuaidi: '运通快递',
          kjde: 'KJDE',
          ewe: 'EWE',
          datianwuliu: '大田物流',
          ecmscn: '易客满',
          lianhaowuliu: '联昊通',
          ndwl: '南方传媒',
          dhl: 'DHL中国',
          dhlen: 'DHL国际',
          usps: 'USPS',
          jialidatong: '嘉里大通',
          yct: '黑猫宅急便',
          yfh: '原飞航',
          lntjs: '特急送',
          huaqikuaiyun: '华企快运',
          sut56: '速通物流',
          jinguangsudikuaijian: '京广快递',
          shenghuiwuliu: '盛辉物流',
          huanqiuabc: '香港环球快运',
          yuanhhk: '远航国际',
          pingandatengfei: '平安达腾飞',
          sxjdfreight: '顺心捷达',
          shpost: '上海同城快递',
          jiuyescm: '九曳供应链',
          ubonex: '优邦快递',
          rlgaus: '澳洲飞跃',
          sxjh: '山西建华',
          spring56: '春风物流',
          zmkmkd: '新配盟',
          xdexpress: '迅达物流',
          luben: '陆本物流',
          riyuwuliu: '日昱物流',
          euasia: '欧亚专线',
          auod: '澳德物流',
          shangqiao56: '商桥物流',
          tnt: 'TNT',
          shangtu: '尚途国际',
          zhonghuan: '中环物流',
          yimidida: '壹米滴答',
          coe: 'COE',
          fengchi: '风驰物流',
          wherexpess: '威盛快递',
          qexpress: '易达通',
          eta100: '易达国际',
          xynyc: '新元国际',
          onexpress: '一速递',
          chnexp: '中翼国际',
          arkexpress: '方舟国际',
          chinaicip: '卓志物流',
          zhongyouex: '众邮快递',
          ajl: '澳捷物流',
          longcps: '龙行速运',
          cccc58: '中集冷云',
          hd: '宏递物流',
          efs: 'EFS（平安快递）',
          sansheng: '三盛物流',
          xlobo: '贝海国际',
          sfwl: '盛丰物流',
          meiquick: '美快物流',
          suteng: '速腾快递',
          xyb2b: '行云物流',
          haidaibao: '海带宝',
          huisensky: '汇森物流',
          fengwang: '丰网快递',
          sxexpress: '三象物流',
          sunjex: '新杰物流',
          kejie: '科捷物流',
          tmwexpress: '明达物流',
          savor: '海信物流',
          nezha: '哪吒速运',
          gdkjk56: '快捷快物流',
          yuxinwuliu: '宇鑫物流',
          szuem: '联运通',
          concare: '中健云康',
          suyoda: '速邮达',
          blex56: '奔力物流',
          fanqiu: '泛球物流',
          jsdky: '极速达',
          subida: '速必达',
          zfex56: '志方物流',
          jingleexpress: 'Jingle快递',
          dekuncn: '德坤物流',
          yztex: '一站通',
          ocs: 'OCS',
          wjwl: '万家物流',
          stonocache: '申通非缓存',
          aliexpress: '无忧物流',
          aramex: 'Aramex',
          amazon: 'Amazon',
          huatong: '华通物流',
          yunexpress: '云途物流',
          xiaomiwuliu: '小米物流',
          ronghui: '融辉物流',
          uniuni: 'Uniuni',
          piggyship: 'Pig物流',
          royal: 'RoyalMail',
          wanb: '万邦物流',
          kder: '快弟来了',
          ywe: 'YWE物流',
          jgwl: '景光物流',
          canpost: '加拿大邮政',
          ubi: 'UBI物流',
          sagawa: 'Sagawa',
          jiacheng: '佳成物流',
          japanpost: '日本邮政',
          huahanwuliu: '华翰物流',
          shshouwu: '上海守务',
          benniao: '笨鸟物流',
          quipuwin: '奇普文物流',
          posteit: '意大利邮政',
          evri: 'EVRI',
          koreapost: 'KoreaPost',
          gofo: 'GOFO物流',
          swiftx: 'SwiftX物流',
          shunyanwl: '顺衍物流',
        };
        carrierName = carrierMap[carrierCode] || carrierCode;
      }

      if (!order) {
        // 创建订单前，再次检查订单是否已存在（防止并发创建重复订单）
        try {
          const existingOrder = await this.ordersService.getOrderByOrderNumber(kddh);
          if (existingOrder) {
            order = existingOrder;
            console.log(`订单 ${kddh} 已存在，使用现有订单`);
          }
        } catch (error) {
          console.warn('检查订单是否存在时出错:', error);
        }

        // 只有在订单确实不存在时才创建新订单
        if (!order) {
          // 创建新订单
          order = await this.ordersService.createOrder({
            order_number: kddh,
            customer_name: customer_name,
            department_key: department_key,

            // ★★★ 新增：传入 carrier_code ★★★
            carrier_code: carrierCode, // 将识别到的或传入的快递代码 (如 'shunfeng') 存入

            // 必须提供carrier字段，因为数据库中需要这个字段
            carrier: carrierName, // 快递公司中文名称

            status: OrderStatus.PENDING,
            warning_status: WarningStatus.NONE,
            is_archived: false,
            receiverPhone: phoneStr,
            details: {
              phone: phoneStr,
              carrierName: carrierName, // 建议把中文名称存到 details 里
              logisticsQueryFailed: true,
              logisticsQueryErrorMessage: '',
            },
          } as any); // 使用 as any 临时规避类型检查，直到你更新完所有类型定义
        }
      } else {
        // ✅ 修复：更新已有订单的相关信息
        order = await this.ordersService.updateOrder(order.id, {
          receiverPhone: phoneStr, // 更新收货人电话
          details: {
            ...order.details,
            phone: phoneStr, // 更新详情中的电话
            logisticsQueryFailed: true,
            logisticsQueryErrorMessage: '',
          },
        } as any);
      }

      // 3. 调用第三方API (带轮询重试)
      let logisticsInfo: LogisticsData | null = null;
      let syncError: string = '';
      let taskName: string = '';

      console.log('=== 最终承运商信息 ===');
      console.log('最终使用的carrierCode:', carrierCode);
      console.log('最终使用的carrierName:', carrierName);

      try {
        const createParams: any = {
          ...this.logisticsConfig,
          zffs: 'jinbi',
          kdgs: carrierCode,
          kddhs: kddh,
          isBackTaskName: 'yes',
        };

        // ✅ 修复：根据不同快递公司要求添加手机尾号
        // 顺丰和中通都需要手机尾号
        if (
          carrierCode === 'shunfeng' ||
          carrierCode === 'SF' ||
          carrierCode === 'zhongtong'
        ) {
          // 安全截取后四位，只有当手机格式正确时才添加
          if (phoneStr && phoneStr.length >= 4) {
            const phoneTail = phoneStr.slice(-4);
            createParams.kddhs = `${kddh}||${phoneTail}`;
          }
          // 如果没有有效手机尾号，不添加，避免使用默认值导致API调用失败
        }

        // ✅ 修复：添加详细的创建任务日志，用于调试
        console.log('=== 开始创建物流查询任务 ===');
        console.log('物流API基础URL:', this.logisticsApiBaseUrl);
        console.log('创建任务参数:', JSON.stringify(createParams, null, 2));

        // 更新订单进度为20%
        await this.ordersService.updateOrderStatus(order.id, {
          details: {
            ...order.details,
            phone: phoneStr,
            logisticsQueryProgress: 20,
            logisticsQueryStatus: '创建物流查询任务中...',
          },
        });

        const createResponse = await this.httpPost(
          `${this.logisticsApiBaseUrl}create/`,
          createParams,
        );
        const parsedCreate =
          typeof createResponse === 'string'
            ? JSON.parse(createResponse)
            : createResponse;

        // ✅ 修复：添加详细的创建任务响应日志，用于调试
        console.log('创建任务响应:', JSON.stringify(parsedCreate, null, 2));

        if (parsedCreate.code !== 1) {
          console.error('创建任务失败:', parsedCreate.msg);
          throw new Error(`任务创建失败: ${parsedCreate.msg}`);
        }
        taskName = parsedCreate.msg;

        // ✅ 修复：添加任务名称日志，用于调试
        console.log(`创建物流查询任务成功，任务名称: ${taskName}`);
        console.log('=== 物流查询任务创建完成 ===');

        // 更新订单进度为30%
        await this.ordersService.updateOrderStatus(order.id, {
          details: {
            ...order.details,
            phone: phoneStr,
            logisticsQueryProgress: 30,
            logisticsQueryStatus: '等待物流API响应...',
          },
        });

        // ✅ 修复：在轮询前增加短暂延迟，确保任务有足够时间被创建
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 5秒延迟

        // ✅ 修复：优化轮询逻辑，支持40分钟的长时间任务处理
        let retryCount = 0;
        const maxRetries = 96; // 最多重试96次 (96次 × 25秒平均间隔 = 2400秒 = 40分钟)
        const baseRetryInterval = 20000; // 基础重试间隔20秒
        const retryInterval = baseRetryInterval + Math.random() * 10000; // 20-30秒随机间隔，避免API限流

        while (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryInterval));
          retryCount++;

          // ✅ 修复：添加轮询日志，用于调试
          console.log(
            `正在查询物流任务状态，任务名称: ${taskName} (第${retryCount}次重试)`,
          );

          // 计算当前进度 (30% - 90%)
          const currentProgress = 30 + (retryCount / maxRetries) * 60;

          const selectParams = {
            ...this.logisticsConfig,
            pageno: 1,
            taskname: taskName,
          };
          const selectRes = await this.httpPost(
            `${this.logisticsApiBaseUrl}select/`,
            selectParams,
          );
          const parsedSelect =
            typeof selectRes === 'string' ? JSON.parse(selectRes) : selectRes;

          if (parsedSelect.code === 1) {
            // 检查任务是否完成
            // ✅ 修复：添加详细的日志，查看parsedSelect的完整结构
            console.log(`第三方API返回数据: ${JSON.stringify(parsedSelect)}`);

            const currentProgress = parsedSelect.msg?.jindu || 0;

            // ✅ 修复：当进度达到99%或100%时都认为任务已经完成
            // 有些任务可能永远不会达到100%，但实际上已经完成
            if (currentProgress >= 99) {
              // 如果有list数据，使用第一个
              if (parsedSelect.msg?.list?.length > 0) {
                logisticsInfo = parsedSelect.msg.list[0];
                console.log(
                  `使用第三方API返回的物流信息: ${JSON.stringify(logisticsInfo)}`,
                );
              } else {
                // ✅ 修复：即使没有list数据，只要进度达到99%，也认为任务完成
                // 创建一个基础的物流信息对象
                logisticsInfo = {
                  kddh: kddh,
                  kdgs: carrierCode,
                  wuliuzhuangtai: '已查询',
                  tiaoshu: 0,
                  fachushijian: '',
                  zuixinshijian: '',
                  zuihouwuliu: '暂无详细物流信息',
                  xiangxiwuliu: '',
                  chaxunshijian: new Date().toISOString(),
                  dingdanhao: customer_name,
                  wwlyuan: '',
                };
                console.log(
                  `创建基础物流信息对象: ${JSON.stringify(logisticsInfo)}`,
                );
              }
              console.log(
          `物流查询完成，最终物流信息: ${JSON.stringify(logisticsInfo)}`,
        );
        
        // 更新订单进度为90%
        await this.ordersService.updateOrderStatus(order.id, {
          details: {
            ...order.details,
            phone: phoneStr,
            logisticsQueryProgress: 90,
            logisticsQueryStatus: '分析物流信息...',
          },
        });
        
        break;
      } else {
          // 定期更新订单状态，记录当前进度
          console.log(
            `物流查询进度: ${currentProgress}% (重试 ${retryCount}/${maxRetries})`,
          );
          await this.ordersService.updateOrderStatus(order.id, {
            details: {
              ...order.details,
              phone: phoneStr,
              logisticsQueryProgress: currentProgress,
              logisticsQueryStatus: `轮询中... (${retryCount}/${maxRetries})`,
              logisticsQueryRetries: retryCount,
            },
          });
        }
          } else {
            // ✅ 修复：处理任务不存在错误，尝试重新创建任务
            if (
              parsedSelect.msg?.includes('任务不存在') ||
              parsedSelect.msg?.includes('任务不存在')
            ) {
              console.error(
                `任务不存在，尝试重新创建任务 (第${retryCount}次重试)`,
              );

              // 更新订单状态
              await this.ordersService.updateOrderStatus(order.id, {
                details: {
                  ...order.details,
                  phone: phoneStr,
                  logisticsQueryStatus: '任务不存在，尝试重新创建...',
                },
              });

              // 尝试重新创建任务
              try {
                const recreateParams: any = {
                  ...this.logisticsConfig,
                  zffs: 'jinbi',
                  kdgs: carrierCode,
                  kddhs: kddh,
                  isBackTaskName: 'yes',
                };

                // 重新添加手机尾号（如果需要）
                if (
                  carrierCode === 'shunfeng' ||
                  carrierCode === 'SF' ||
                  carrierCode === 'zhongtong'
                ) {
                  // 安全截取后四位，只有当手机格式正确时才添加
                  if (phoneStr && phoneStr.length >= 4) {
                    const phoneTail = phoneStr.slice(-4);
                    recreateParams.kddhs = `${kddh}||${phoneTail}`;
                  }
                }

                const recreateResponse = await this.httpPost(
                  `${this.logisticsApiBaseUrl}create/`,
                  recreateParams,
                );
                const parsedRecreate =
                  typeof recreateResponse === 'string'
                    ? JSON.parse(recreateResponse)
                    : recreateResponse;

                if (parsedRecreate.code === 1) {
                  taskName = parsedRecreate.msg;
                  console.log(`重新创建任务成功，新任务名称: ${taskName}`);
                  // 短暂延迟后继续轮询
                  await new Promise((resolve) => setTimeout(resolve, 5000));
                  continue;
                } else {
                  console.error(`重新创建任务失败: ${parsedRecreate.msg}`);
                }
              } catch (error) {
                console.error(`重新创建任务时发生错误:`, error);
              }
            } else if (
              parsedSelect.msg?.includes(
                '此任务刚刚select过一次，故本次请求被驳回',
              )
            ) {
              // ✅ 修复：处理请求被驳回错误，增加重试间隔
              console.warn(`请求被驳回，增加重试间隔 (第${retryCount}次重试)`);
              // 增加重试间隔，避免频繁请求
              // 使用指数退避策略，每次收到驳回响应时，将重试间隔翻倍
              const backoffInterval = Math.min(
                30000 * Math.pow(2, retryCount),
                300000,
              ); // 最大5分钟
              console.log(`使用指数退避策略，重试间隔: ${backoffInterval}ms`);
              await new Promise((resolve) =>
                setTimeout(resolve, backoffInterval),
              );
              continue;
            } else {
              // 其他API调用失败，尝试继续重试
              console.error(`第${retryCount}次查询失败:`, parsedSelect.msg);
            }
          }
        }

        if (!logisticsInfo) {
          // 如果超时，记录状态并返回，让调度器后续继续处理
          await this.ordersService.updateOrderStatus(order.id, {
            details: {
              ...order.details,
              phone: phoneStr,
              logisticsQueryFailed: true,
              logisticsQueryErrorMessage: '请求超时，请稍后查看',
              logisticsQueryProgress: 0,
              logisticsQueryStatus: '请求超时',
              logisticsQueryRetries: retryCount,
            },
          });
          // 不抛出错误，而是返回当前状态
          const updatedOrder = await this.ordersService.getOrderById(order.id);
          return {
            code: 0,
            msg: {
              order: updatedOrder,
              logisticsInfo: null,
              logisticsQuerySuccess: false,
              logisticsQueryError: '请求超时，请稍后查看',
              progress: 0,
            },
          };
        }

        // 4. 更新数据库
        // ✅ 修复：确保使用有效的订单ID
        let orderToUpdate = order;
        try {
          // 先尝试使用当前order对象
          await this.ordersService.getOrderById(order.id);
        } catch (error) {
          // 如果当前order对象的ID无效，使用order_number重新查找订单
          console.warn('订单ID无效，尝试使用订单号重新查找:', order.id);
          const existingOrder =
            await this.ordersService.getOrderByOrderNumber(kddh);
          if (existingOrder) {
            console.log('使用订单号查找成功，新订单ID:', existingOrder.id);
            orderToUpdate = existingOrder;
          } else {
            console.error('订单不存在，无法更新状态:', kddh);
            throw new Error(`订单不存在，无法更新状态: ${kddh}`);
          }
        }

        // 计算订单状态和预警状态
        const orderStatusStr = this.logisticsUtilService.mapLogisticsStatus(
          logisticsInfo.wuliuzhuangtai,
        );
        let orderStatus: OrderStatus;

        // 安全的枚举转换：根据字符串值查找对应的枚举成员
        switch (orderStatusStr) {
          case 'pending':
            orderStatus = OrderStatus.PENDING;
            break;
          case 'in_transit':
            orderStatus = OrderStatus.IN_TRANSIT;
            break;
          case 'delivered':
            orderStatus = OrderStatus.DELIVERED;
            break;
          case 'returned':
            orderStatus = OrderStatus.RETURNED;
            break;
          case 'exception':
            orderStatus = OrderStatus.EXCEPTION;
            break;
          default:
            this.logger.warn(
              `订单 ${orderToUpdate.id} 状态转换失败: orderStatusStr="${orderStatusStr}"，使用默认状态 PENDING`,
            );
            orderStatus = OrderStatus.PENDING;
            break;
        }
        let warningStatus = WarningStatus.NONE;

        // 分析物流轨迹中的最新状态
        const trackingNodes = this.logisticsUtilService.parseTrackingDetails(
          logisticsInfo.xiangxiwuliu || '',
        );

        // 如果第三方物流状态已经是异常，直接使用该状态
        if (orderStatus === OrderStatus.EXCEPTION) {
          warningStatus = WarningStatus.TRANSIT_ABNORMAL;
          this.logger.log(
            `订单 ${orderToUpdate.id} 第三方物流状态显示异常，状态设置为 EXCEPTION，预警状态为 TRANSIT_ABNORMAL`,
          );
        } else {
          // 只有当第三方物流状态不是异常时，才分析物流轨迹和检测关键字
          if (trackingNodes.length > 0) {
            const latestTracking = trackingNodes[0]; // 最新的物流记录在第一位
            if (
              latestTracking.description.includes('送货上门') ||
              latestTracking.description.includes('已签收') ||
              latestTracking.description.includes('签收') ||
              latestTracking.description.includes('簽收') ||
              (latestTracking.description.includes('已被') && latestTracking.description.includes('签收')) ||
              latestTracking.description.includes('被签收') ||
              latestTracking.description.includes('派送成功') ||
              latestTracking.description.includes('投递成功') ||
              latestTracking.description.includes('已交付') ||
              latestTracking.description.includes('取出') ||
              latestTracking.description.includes('已取出') ||
              latestTracking.description.includes('已从代收点取出') ||
              latestTracking.description.includes('包裹已从代收点取出') ||
              latestTracking.description.includes('包裹已送至') ||
              latestTracking.description.includes('妥投') ||
              latestTracking.description.includes('完成取件') ||
              latestTracking.description.includes('收件人已取走邮件') ||
              latestTracking.description.includes('已完成配送') ||
              latestTracking.description.includes('客户已取件') ||
              latestTracking.description.includes('由收件人领取') ||
              latestTracking.description.includes('signed') ||
              latestTracking.description.includes('delivered') ||
              latestTracking.description.includes('邮件已取走') ||
              latestTracking.description.includes('已由客户自提') ||
              latestTracking.description.includes('自提已接收') ||
              latestTracking.description.includes('包裹已送货上门') ||
              latestTracking.description.includes('已确认收货') ||
              latestTracking.description.includes('全部快件派送完成') ||
              latestTracking.description.includes('收件人为') ||
              latestTracking.description.includes('签收人在') ||
              (latestTracking.description.includes('签收人在') && latestTracking.description.includes('取件')) ||
              latestTracking.description.includes('送达代收点') ||
              latestTracking.description.includes('代收点存放') ||
              latestTracking.description.includes('代收点已存放') ||
               latestTracking.description.includes('已送达代收点') ||
              latestTracking.description.includes('已存放代收点') ||
              latestTracking.description.includes('送达代收点存放') ||
              latestTracking.description.includes('已送达代收点存放') ||
              (latestTracking.description.includes('代收点') && latestTracking.description.includes('存放')) ||
              latestTracking.description.includes('已由快递员送达代收点存放') ||
              latestTracking.description.includes('前台签收') ||
              latestTracking.description.includes('放置在前台') ||
              latestTracking.description.includes('前台存放') ||
              latestTracking.description.includes('前台已签收') ||
              latestTracking.description.includes('前台代收') ||
              latestTracking.description.includes('门卫签收') ||
              latestTracking.description.includes('门岗签收') ||
              latestTracking.description.includes('物业签收') ||
              latestTracking.description.includes('物管签收') ||
              latestTracking.description.includes('智能柜') ||
              latestTracking.description.includes('快递柜') ||
              latestTracking.description.includes('柜存')
            ) {
              orderStatus = OrderStatus.DELIVERED;
              warningStatus = WarningStatus.NONE; // 已签收的订单不应该有异常预警
              this.logger.log(
                `订单 ${orderToUpdate.id} 物流轨迹显示已签收/取出，状态设置为 DELIVERED`,
              );
            } else if (
              latestTracking.description.includes('退回') ||
              latestTracking.description.includes('被退回')
            ) {
              orderStatus = OrderStatus.RETURNED;
              warningStatus = WarningStatus.NONE; // 已退回的订单不应该有异常预警
              this.logger.log(
                `订单 ${orderToUpdate.id} 物流轨迹显示已退回，状态设置为 RETURNED`,
              );
            } else if (
              latestTracking.description.includes('发往') ||
              latestTracking.description.includes('运往') ||
              latestTracking.description.includes('运输') ||
              latestTracking.description.includes('派送') ||
              latestTracking.description.includes('揽收') ||
              latestTracking.description.includes('已发货') ||
              latestTracking.description.includes('已揽收') ||
              latestTracking.description.includes('正在派送') ||
              latestTracking.description.includes('已到达') ||
              latestTracking.description.includes('已发出') ||
              latestTracking.description.includes('已离开') ||
              latestTracking.description.includes('中转')
            ) {
              orderStatus = OrderStatus.IN_TRANSIT;
              this.logger.log(
                `订单 ${orderToUpdate.id} 物流轨迹显示运输中，状态设置为 IN_TRANSIT`,
              );
            }
          }

          // 检测物流信息中的异常状态
          const hasAbnormal =
            logisticsInfo.wuliuzhuangtai.includes('异常') ||
            logisticsInfo.xiangxiwuliu.includes('异常') ||
            logisticsInfo.wuliuzhuangtai.includes('问题') ||
            logisticsInfo.xiangxiwuliu.includes('问题') ||
            logisticsInfo.wuliuzhuangtai.includes('失败') ||
            logisticsInfo.xiangxiwuliu.includes('失败') ||
            logisticsInfo.wuliuzhuangtai.includes('派送不成功') ||
            logisticsInfo.xiangxiwuliu.includes('派送不成功') ||
            logisticsInfo.wuliuzhuangtai.includes('未妥投') ||
            logisticsInfo.xiangxiwuliu.includes('未妥投') ||
            logisticsInfo.wuliuzhuangtai.includes('反签收') ||
            logisticsInfo.xiangxiwuliu.includes('反签收') ||
            logisticsInfo.wuliuzhuangtai.includes('拒签') ||
            logisticsInfo.xiangxiwuliu.includes('拒签') ||
            logisticsInfo.wuliuzhuangtai.includes('退件') ||
            logisticsInfo.xiangxiwuliu.includes('退件') ||
            logisticsInfo.wuliuzhuangtai.includes('无法') ||
            logisticsInfo.xiangxiwuliu.includes('无法') ||
            logisticsInfo.wuliuzhuangtai.includes('未通过') ||
            logisticsInfo.xiangxiwuliu.includes('未通过') ||
            logisticsInfo.wuliuzhuangtai.includes('异常件') ||
            logisticsInfo.xiangxiwuliu.includes('异常件') ||
            logisticsInfo.wuliuzhuangtai.includes('客户已取消寄件') ||
            logisticsInfo.xiangxiwuliu.includes('客户已取消寄件') ||
            logisticsInfo.wuliuzhuangtai.includes('您的快件取消成功') ||
            logisticsInfo.xiangxiwuliu.includes('您的快件取消成功') ||
            logisticsInfo.wuliuzhuangtai.includes('拒收') ||
            logisticsInfo.xiangxiwuliu.includes('拒收') ||
            logisticsInfo.wuliuzhuangtai.includes('待进一步处理') ||
            logisticsInfo.xiangxiwuliu.includes('待进一步处理') ||
            logisticsInfo.wuliuzhuangtai.includes('问题件') ||
            logisticsInfo.xiangxiwuliu.includes('问题件') ||
            logisticsInfo.wuliuzhuangtai.includes('转寄更改单') ||
            logisticsInfo.xiangxiwuliu.includes('转寄更改单') ||
            logisticsInfo.wuliuzhuangtai.includes('退货') ||
            logisticsInfo.xiangxiwuliu.includes('退货') ||
            logisticsInfo.wuliuzhuangtai.includes('无法正常派送') ||
            logisticsInfo.xiangxiwuliu.includes('无法正常派送') ||
            logisticsInfo.wuliuzhuangtai.includes('地址不详') ||
            logisticsInfo.xiangxiwuliu.includes('地址不详') ||
            logisticsInfo.wuliuzhuangtai.includes('无法找到') ||
            logisticsInfo.xiangxiwuliu.includes('无法找到') ||
            logisticsInfo.wuliuzhuangtai.includes('暂未联系上客户') ||
            logisticsInfo.xiangxiwuliu.includes('暂未联系上客户') ||
            logisticsInfo.wuliuzhuangtai.includes('电话无人接听') ||
            logisticsInfo.xiangxiwuliu.includes('电话无人接听') ||
            logisticsInfo.wuliuzhuangtai.includes('无法接通') ||
            logisticsInfo.xiangxiwuliu.includes('无法接通') ||
            logisticsInfo.wuliuzhuangtai.includes('关机') ||
            logisticsInfo.xiangxiwuliu.includes('关机');
          if (hasAbnormal) {
            orderStatus = OrderStatus.EXCEPTION;
            warningStatus = WarningStatus.TRANSIT_ABNORMAL;
            this.logger.log(
              `订单 ${orderToUpdate.id} 物流信息关键字检测显示异常，状态设置为 EXCEPTION，预警状态为 TRANSIT_ABNORMAL`,
            );
          }
        }

        this.logger.log(
          `订单 ${orderToUpdate.id} 状态更新: wuliuzhuangtai="${logisticsInfo.wuliuzhuangtai}", 计算状态="${orderStatus}", 预警状态="${warningStatus}"`,
        );

        // 使用有效的订单ID更新订单状态
        await this.ordersService.updateOrderStatus(orderToUpdate.id, {
          status: orderStatus,
          warning_status: warningStatus,
          details: {
            ...orderToUpdate.details,
            phone: phoneStr,
            trackingInfo: logisticsInfo,
            tracking: trackingNodes,
            lastTrackingUpdate: new Date().toISOString(),
            logisticsQueryFailed: false,
            logisticsQueryErrorMessage: '',
            logisticsQueryProgress: 100,
            logisticsQueryStatus: '物流查询完成',
          },
        });

        const updatedOrder = await this.ordersService.getOrderById(
          orderToUpdate.id,
        );
        return {
          code: 1,
          msg: {
            order: updatedOrder,
            logisticsInfo,
            logisticsQuerySuccess: true,
          },
        };
      } catch (error) {
        syncError = (error as Error).message;

        // 安全处理：只有当订单已经成功创建时，才更新订单状态
        if (order) {
          await this.ordersService.updateOrderStatus(order.id, {
            // ✅ 修复：查询失败时不重置订单状态，保持原有状态
            // status: OrderStatus.PENDING,
            warning_status: WarningStatus.NONE,
            details: {
              ...order.details,
              phone: phoneStr,
              logisticsQueryFailed: true,
              logisticsQueryErrorMessage: syncError,
              logisticsQueryProgress: 0,
              logisticsQueryStatus: '查询失败',
            },
          });
          const updatedOrder = await this.ordersService.getOrderById(order.id);
          return {
            code: 0,
            msg: {
              order: updatedOrder,
              logisticsInfo: null,
              logisticsQuerySuccess: false,
              logisticsQueryError: syncError,
            },
          };
        } else {
          // 如果订单创建失败，直接返回错误信息
          return {
            code: 0,
            msg: {
              order: null,
              logisticsInfo: null,
              logisticsQuerySuccess: false,
              logisticsQueryError: `订单创建失败: ${syncError}`,
            },
          };
        }
      }
    } catch (error) {
      throw new HttpException(
        '系统错误: ' + (error as Error).message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private mapLogisticsStatus(status: string): OrderStatus {
    const s = status.toLowerCase();

    // 签收、代收、已完成、完成等都视为已送达
    if (
      s.includes('签收') ||
      s.includes('代收') ||
      s.includes('已完成') ||
      s.includes('完成')
    )
      return OrderStatus.DELIVERED;
    if (s.includes('退回')) return OrderStatus.RETURNED;
    // 运输、派件、揽收、已发货等都视为在运输中
    if (
      s.includes('运输') ||
      s.includes('派件') ||
      s.includes('揽收') ||
      s.includes('已发货')
    )
      return OrderStatus.IN_TRANSIT;

    // 默认状态
    return OrderStatus.PENDING;
  }

  private parseTrackingDetails(details: string): any[] {
    if (!details || details === '//太长省略//') return [];

    const nodes: any[] = [];

    // 尝试解析HTML格式的物流信息
    try {
      // 使用正则表达式提取物流节点：每个节点是 "描述<br><i>时间</i>"
      const nodeRegex = /([^<]+)<br><i>([^<]+)<\/i>/g;
      let match;

      while ((match = nodeRegex.exec(details)) !== null) {
        const description = match[1].trim();
        const timeStr = match[2].trim();

        if (description && timeStr) {
          // 尝试解析时间字符串为Date对象
          const timestamp = new Date(timeStr).toISOString();

          nodes.push({
            time: timeStr,
            timestamp: timestamp, // ✅ 修复：添加timestamp字段
            description,
            // 添加默认字段以保持与原有格式兼容
            status: '已签收',
            areaCode: '',
            areaName: '',
            type: 'TRANSIT',
            // ✅ 修复：添加location字段，避免前端报错
            location: '',
          });
        }
      }

      // 如果没有匹配到，尝试第二种格式（用 | 分隔的文本）
      if (nodes.length === 0) {
        const lines = details.split('\n');
        for (const line of lines) {
          const parts = line.split('|');
          if (parts.length >= 2) {
            const timeStr = parts[0].trim();
            const description = parts.slice(1).join('|').trim();
            const timestamp = new Date(timeStr).toISOString();

            nodes.push({
              time: timeStr,
              timestamp: timestamp, // ✅ 修复：添加timestamp字段
              description,
              status: '已签收',
              areaCode: '',
              areaName: '',
              type: 'TRANSIT',
              // ✅ 修复：添加location字段，避免前端报错
              location: '',
            });
          }
        }
      }
    } catch (error) {
      console.error('解析物流信息失败:', error);
    }

    return nodes;
  }
}
