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

  @Column({ name: "collected_at", type: "timestamptz" })
  collected_at!: Date;

  @CreateDateColumn({ name: "received_at", type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  received_at?: Date;
}
