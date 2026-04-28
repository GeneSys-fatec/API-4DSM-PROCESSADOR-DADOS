import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("measurements")
export class Measurement {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  id_parameter?: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  raw_value?: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  value?: number;

  @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
  decimal_2_4?: number;

  @Column({ type: "timestamp", nullable: true })
  timestamp?: Date;

  @CreateDateColumn()
  collected_at?: Date;

  @CreateDateColumn()
  received_at?: Date;
}
