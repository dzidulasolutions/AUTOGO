import { Test, TestingModule } from '@nestjs/testing';
import { TontinesService } from './tontines.service';

describe('TontinesService', () => {
  let service: TontinesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TontinesService],
    }).compile();

    service = module.get<TontinesService>(TontinesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
