import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common';
import {
  Client,
  ClientProxy,
  EventPattern,
  MessagePattern,
  Transport,
} from '@nestjs/microservices';
import { from, Observable, of } from 'rxjs';
import { scan } from 'rxjs/operators';

@Controller()
export class MqttController {
  static IS_NOTIFIED = false;
  static IS_WILDCARD_EVENT_RECEIVED = false;

  @Client({ transport: Transport.MQTT })
  client: ClientProxy;

  @Post()
  @HttpCode(200)
  async call(
    @Query('command') cmd,
    @Body() data: number[],
  ): Promise<Observable<number>> {
    await this.client.connect();
    return this.client.send<number>({ cmd }, data);
  }

  @Post('stream')
  @HttpCode(200)
  stream(@Body() data: number[]): Observable<number> {
    return this.client
      .send<number>({ cmd: 'streaming' }, data)
      .pipe(scan((a, b) => a + b));
  }

  @Post('concurrent')
  @HttpCode(200)
  async concurrent(@Body() data: number[][]): Promise<boolean> {
    const send = async (tab: number[]) => {
      const expected = tab.reduce((a, b) => a + b);
      const result = await this.client
        .send<number>({ cmd: 'sum' }, tab)
        .toPromise();

      return result === expected;
    };
    return data
      .map(async tab => send(tab))
      .reduce(async (a, b) => (await a) && b);
  }

  @Post('notify')
  async sendNotification(): Promise<any> {
    return this.client.emit<number>('notification', true);
  }

  @Post('wildcard-event')
  async sendWilcardEvent(): Promise<any> {
    return this.client.emit<number>('wildcard-event/test', true);
  }

  @EventPattern('wildcard-event/#')
  wildcardEventHandler(data: boolean) {
    MqttController.IS_WILDCARD_EVENT_RECEIVED = true;
  }

  @EventPattern('notification')
  eventHandler(data: boolean) {
    MqttController.IS_NOTIFIED = true;
  }

  @MessagePattern({ cmd: 'sum' })
  sum(data: number[]): number {
    return (data || []).reduce((a, b) => a + b);
  }

  @MessagePattern({ cmd: 'asyncSum' })
  async asyncSum(data: number[]): Promise<number> {
    return (data || []).reduce((a, b) => a + b);
  }

  @MessagePattern({ cmd: 'streamSum' })
  streamSum(data: number[]): Observable<number> {
    return of((data || []).reduce((a, b) => a + b));
  }

  @MessagePattern({ cmd: 'streaming' })
  streaming(data: number[]): Observable<number> {
    return from(data);
  }
}
