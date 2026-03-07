import { Injectable } from '@nestjs/common';
import { LOGISTICS_NAME_TO_CODE } from '../../common/constants/logistics-map.constant';

@Injectable()
export class TrackingNumberRecognitionService {
  /**
   * 优先根据物流公司名字获取编码（比猜单号更准！）
   */
  public getCodeByName(
    name: string,
  ): { carrierCode: string; carrierName: string } | null {
    if (!name) return null;

    const cleanName = name.trim();
    const code = LOGISTICS_NAME_TO_CODE[cleanName];

    if (code) {
      return { carrierCode: code, carrierName: cleanName };
    }

    // 模糊匹配
    if (cleanName.includes('中通'))
      return { carrierCode: 'zhongtong', carrierName: '中通快递' };
    if (cleanName.includes('顺丰'))
      return { carrierCode: 'shunfeng', carrierName: '顺丰速运' };
    if (cleanName.includes('圆通'))
      return { carrierCode: 'yuantong', carrierName: '圆通速递' };
    if (cleanName.includes('申通'))
      return { carrierCode: 'shentong', carrierName: '申通快递' };
    if (cleanName.includes('韵达'))
      return { carrierCode: 'yunda', carrierName: '韵达快递' };
    if (cleanName.includes('极兔'))
      return { carrierCode: 'jito', carrierName: '极兔速递' };
    if (cleanName.includes('京东'))
      return { carrierCode: 'jd', carrierName: '京东快递' };
    if (cleanName.includes('EMS'))
      return { carrierCode: 'ems', carrierName: 'EMS' };

    return null;
  }

  /**
   * 识别单个物流单号
   */
  async recognizeTrackingNumber(
    trackingNumber: string,
  ): Promise<{ carrierCode: string; carrierName: string }> {
    try {
      const localRecognition =
        this.recognizeTrackingNumberLocally(trackingNumber);
      if (localRecognition) {
        console.log('使用本地规则识别成功:', localRecognition);
        return localRecognition;
      }

      throw new Error('无法识别该物流单号的快递公司');
    } catch (error) {
      console.error('识别物流单号失败:', error);
      throw error;
    }
  }

  /**
   * 使用本地规则识别物流单号
   */
  private recognizeTrackingNumberLocally(
    trackingNumber: string,
  ): { carrierCode: string; carrierName: string } | null {
    try {
      if (!trackingNumber || typeof trackingNumber !== 'string') {
        return null;
      }

      const normalizedNumber = trackingNumber.trim().toUpperCase();
      const cleanedNumber = normalizedNumber.replace(/[^0-9A-Z]/g, '');

      // 顺丰速运
      if (cleanedNumber.startsWith('SF') && /^[0-9A-Z]+$/.test(cleanedNumber)) {
        return { carrierCode: 'shunfeng', carrierName: '顺丰速运' };
      } else if (
        /^[0-9]+$/.test(cleanedNumber) &&
        (cleanedNumber.length === 12 || cleanedNumber.length === 15)
      ) {
        return { carrierCode: 'shunfeng', carrierName: '顺丰速运' };
      }

      // 圆通速递
      if (
        (cleanedNumber.startsWith('YT') && cleanedNumber.length >= 12) ||
        (cleanedNumber.length === 10 && /^[0-9]+$/.test(cleanedNumber))
      ) {
        return { carrierCode: 'yuantong', carrierName: '圆通速递' };
      }

      // 京东物流
      if (cleanedNumber.startsWith('JD') && cleanedNumber.length >= 10) {
        return { carrierCode: 'jd', carrierName: '京东物流' };
      }

      // 跨越速运
      if (cleanedNumber.startsWith('KY') && cleanedNumber.length >= 12) {
        return { carrierCode: 'kuayue', carrierName: '跨越速运' };
      }

      // 中通快递
      if (
        (cleanedNumber.startsWith('ZT') && cleanedNumber.length >= 12) ||
        (cleanedNumber.length === 15 && /^[0-9]+$/.test(cleanedNumber))
      ) {
        return { carrierCode: 'zhongtong', carrierName: '中通快递' };
      }

      // 申通快递
      if (
        (cleanedNumber.startsWith('ST') && cleanedNumber.length >= 12) ||
        (cleanedNumber.length === 15 && /^[0-9]+$/.test(cleanedNumber))
      ) {
        return { carrierCode: 'shentong', carrierName: '申通快递' };
      }

      // 韵达快递
      if (
        (cleanedNumber.startsWith('YD') && cleanedNumber.length >= 12) ||
        (cleanedNumber.length === 13 && /^[0-9]+$/.test(cleanedNumber))
      ) {
        return { carrierCode: 'yunda', carrierName: '韵达快递' };
      }

      // 百世快递
      if (cleanedNumber.startsWith('BS') && cleanedNumber.length >= 12) {
        return { carrierCode: 'huitongkuaidi', carrierName: '百世快递' };
      }

      // 邮政快递
      if (
        (cleanedNumber.startsWith('EMS') && cleanedNumber.length >= 13) ||
        (cleanedNumber.length === 13 &&
          /^[0-9]+$/.test(cleanedNumber) &&
          cleanedNumber.startsWith('1'))
      ) {
        return { carrierCode: 'ems', carrierName: '邮政快递' };
      }

      // 天天快递
      if (
        (cleanedNumber.startsWith('TT') && cleanedNumber.length >= 12) ||
        (cleanedNumber.length === 14 && /^[0-9]+$/.test(cleanedNumber))
      ) {
        return { carrierCode: 'tiantian', carrierName: '天天快递' };
      }

      // 优速快递
      if (cleanedNumber.startsWith('UC') && cleanedNumber.length >= 12) {
        return { carrierCode: 'youshuwuliu', carrierName: '优速快递' };
      }

      // 宅急送
      if (
        (cleanedNumber.startsWith('ZJS') && cleanedNumber.length >= 10) ||
        (cleanedNumber.length === 10 && /^[0-9]+$/.test(cleanedNumber))
      ) {
        return { carrierCode: 'zhaijisong', carrierName: '宅急送' };
      }

      // 极兔速递
      if (cleanedNumber.startsWith('JT') && cleanedNumber.length >= 12) {
        return { carrierCode: 'jito', carrierName: '极兔速递' };
      }

      // 默认规则
      if (/^[0-9A-Z]{10,20}$/.test(cleanedNumber)) {
        return { carrierCode: 'shunfeng', carrierName: '顺丰速运' };
      }

      return null;
    } catch (error) {
      console.error('本地识别物流单号失败:', error);
      return null;
    }
  }

/**
   * 批量识别物流单号 
   */
  async recognizeBatchTrackingNumbers(trackingNumbers: string[]) {
    // 1. 使用 Promise.all 并行处理所有请求，大幅提升速度
    const results = await Promise.all(
      trackingNumbers.map(async (trackingNumber) => {
        try {
          const recognitionResult = await this.recognizeTrackingNumber(trackingNumber);
          return {
            trackingNumber,
            carrierCode: recognitionResult.carrierCode,
            carrierName: recognitionResult.carrierName,
            success: true,
          };
        } catch (error) {
          // 2. 安全地提取错误信息 (防止 error 不是 Error 对象时报错)
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          return {
            trackingNumber,
            carrierCode: '',
            carrierName: '',
            success: false,
            error: errorMessage, // 使用处理过的安全信息
          };
        }
      })
    );

    return results;
  }
}