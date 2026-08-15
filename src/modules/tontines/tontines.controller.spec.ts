import { Test, TestingModule } from '@nestjs/testing';
import { TontinesController } from './tontines.controller';

describe('TontinesController', () => {
  let controller: TontinesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TontinesController],
    }).compile();

    controller = module.get<TontinesController>(TontinesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
