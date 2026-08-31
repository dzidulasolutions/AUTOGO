import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { UploadsService } from '../../uploads/uploads.service';
import { generateMonthlyReportPdf } from '../generators/monthly-report.generator';

@Processor('reports')
export class ReportProcessor extends WorkerHost {
  constructor(
    private prisma: PrismaService,
    private uploadsService: UploadsService,
  ) {
    super();
  }

  async process(job: Job<{ reportId: string }>) {
    const { reportId } = job.data;

    try {
      const report = await this.prisma.report.findUnique({
        where: { id: reportId },
        include: { branch: true },
      });
      if (!report) return;

      interface BranchSummaryRow {
        total_deposits: number;
        total_withdrawals: number;
        total_disbursements: number;
        total_repayments: number;
      }
      interface RiskRow {
        loans_at_risk: number;
        overdue_amount: number;
      }

      const summaryRows = await this.prisma.$queryRaw<BranchSummaryRow[]>`
  SELECT
    COALESCE(SUM(total_deposits), 0) AS total_deposits,
    COALESCE(SUM(total_withdrawals), 0) AS total_withdrawals,
    COALESCE(SUM(total_disbursements), 0) AS total_disbursements,
    COALESCE(SUM(total_repayments), 0) AS total_repayments
  FROM v_branch_daily_summary
  WHERE branch_id = ${report.branchId}
    AND EXTRACT(MONTH FROM summary_date) = ${report.month}
    AND EXTRACT(YEAR FROM summary_date) = ${report.year}
`;

      const riskRows = await this.prisma.$queryRaw<RiskRow[]>`
  SELECT COUNT(*) AS loans_at_risk, COALESCE(SUM(overdue_amount), 0) AS overdue_amount
  FROM v_loan_portfolio_at_risk WHERE branch_id = ${report.branchId}
`;

      const pdfBuffer = await generateMonthlyReportPdf({
        branchName: report.branch.name,
        month: report.month,
        year: report.year,
        totalDeposits: Number(summaryRows[0].total_deposits),
        totalWithdrawals: Number(summaryRows[0].total_withdrawals),
        totalDisbursements: Number(summaryRows[0].total_disbursements),
        totalRepayments: Number(summaryRows[0].total_repayments),
        loansAtRisk: Number(riskRows[0].loans_at_risk),
        overdueAmount: Number(riskRows[0].overdue_amount),
      });

      const fakeFile = {
        buffer: pdfBuffer,
        mimetype: 'application/pdf',
      } as Express.Multer.File;
      const fileUrl = await this.uploadsService.uploadFile(fakeFile);

      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'READY', fileUrl },
      });
    } catch (error) {
      console.error(`Erreur generation rapport ${reportId}:`, error);
      await this.prisma.report.update({
        where: { id: reportId },
        data: { status: 'FAILED' },
      });
    }
  }
}
