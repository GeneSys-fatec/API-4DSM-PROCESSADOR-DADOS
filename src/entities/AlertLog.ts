import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("alert_logs")
export class AlertLog {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  id_start_rule?: number;

  @Column({ default: "system" })
  login?: string;

  @Column({ nullable: true })
  text?: string;

  @Column({ nullable: true })
  triggered_value?: string;

  @Column({ nullable: true })
  triggered_at?: Date;

  @CreateDateColumn()
  received_at?: Date;

  @Column({ default: "alert_status_error" })
  status?: string;
}
