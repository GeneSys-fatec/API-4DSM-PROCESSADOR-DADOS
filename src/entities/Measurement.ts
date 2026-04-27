import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("measurements")
export class Measurement {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ nullable: true })
  id_parameter?: number;

  @Column({ nullable: true })
  raw_value?: number;

  @Column({ nullable: true })
  decimal_2_4?: number;

  @Column({ nullable: true })
  timestamp?: Date;

  @CreateDateColumn()
  collected_at?: Date;

  @CreateDateColumn()
  received_at?: Date;
}
